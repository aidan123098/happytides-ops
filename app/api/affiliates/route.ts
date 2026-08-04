import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  archiveAffiliateCode,
  canonicalAffiliateStatus,
  canChangeAffiliateRate,
  canTransitionAffiliateStatus
} from "@/lib/affiliate-rules";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { createOfflineAffiliate, deleteOfflineAffiliate, isDatabaseUnavailable, updateOfflineAffiliate } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { getAffiliateById, getAffiliateDetail, getAffiliates, invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { affiliateInputSchema, affiliateUpdateSchema } from "@/lib/validation";

class AffiliateRouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function validationError(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error.issues as Array<{ path: Array<string | number>; message: string }>) : [];
  const detail = issues[0] ? `${issues[0].path.join(".")}: ${issues[0].message}` : "Check the required fields and try again.";
  return NextResponse.json({ error: detail }, { status: 400 });
}

function routeError(error: unknown) {
  if (error instanceof AffiliateRouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "That affiliate code is already in use." }, { status: 409 });
  }
  throw error;
}

async function domainAffiliate(id: string) {
  return getAffiliateById(id);
}

async function isWebsiteAffiliate(tx: Prisma.TransactionClient, affiliateId: string) {
  const rows = await tx.$queryRaw<Array<{ linked: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM storefront.affiliate_accounts WHERE affiliate_id = ${affiliateId}
    ) AS linked
  `;
  return rows[0]?.linked ?? false;
}

async function reviewWebsiteAffiliate(tx: Prisma.TransactionClient, affiliateId: string, action: "approved" | "disabled" | "rejected", notes?: string) {
  await tx.$queryRaw`
    SELECT public.review_storefront_affiliate(${affiliateId}, ${action}, ${notes ?? null})
  `;
}

export async function GET(request: Request) {
  await requirePermission("reports:read");
  const url = new URL(request.url);
  const affiliateId = url.searchParams.get("affiliateId");

  if (affiliateId) {
    const detail = await getAffiliateDetail(affiliateId);
    return detail
      ? NextResponse.json({ detail })
      : NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  }

  const includeArchived = url.searchParams.get("includeArchived") === "1";
  return NextResponse.json({ affiliates: await getAffiliates({ includeArchived }) });
}

export async function POST(request: Request) {
  const actor = await requirePermission("settings:manage");
  const body = await request.json();
  const parsed = affiliateInputSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed.error);

  const payload = parsed.data;
  const payoutRatePercent = typeof body.payoutRatePercent === "number" ? payload.payoutRatePercent : 20;
  const payoutRateBps = Math.round(payoutRatePercent * 100);

  try {
    const affiliate = await prisma.$transaction(async (tx) => {
      const created = await tx.affiliate.create({
        data: {
          name: payload.name.trim(),
          code: payload.code,
          affiliateType: payload.affiliateType,
          status: "pending",
          revenueGeneratedCents: 0,
          payoutRateBps,
          totalPayoutCents: 0,
          payoutDueCents: 0,
          referredCustomers: 0,
          referredOrders: 0,
          lastPayoutAt: null,
          notes: payload.notes
        }
      });

      await writeAuditLog({ actor, entityType: "AFFILIATE", entityId: created.id, action: "AFFILIATE_CREATED", after: created, request }, tx);
      return created;
    });

    invalidateOperationalDataCache();
    return NextResponse.json({ affiliate: await domainAffiliate(affiliate.id) }, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const affiliate = createOfflineAffiliate({
        name: payload.name,
        code: payload.code,
        affiliateType: payload.affiliateType,
        status: "pending",
        revenueGeneratedCents: payload.revenueGeneratedCents,
        payoutRatePercent,
        totalPayoutCents: payload.totalPayoutCents,
        referredCustomers: payload.referredCustomers,
        referredOrders: payload.referredOrders,
        lastPayoutAt: payload.lastPayoutAt ?? "N/A",
        notes: payload.notes ?? "N/A"
      });
      return NextResponse.json({ affiliate }, { status: 201 });
    }
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  const actor = await requirePermission("settings:manage");
  const body = await request.json();

  const parsed = affiliateUpdateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const payload = parsed.data;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.affiliate.findUnique({ where: { id: payload.affiliateId } });
      if (!before || before.archivedAt) throw new AffiliateRouteError("Affiliate not found", 404);
      const currentStatus = canonicalAffiliateStatus(before.status, before.archivedAt);
      if (payload.status && !canTransitionAffiliateStatus(currentStatus, payload.status)) {
        throw new AffiliateRouteError(`Affiliate status cannot change from ${before.status} to ${payload.status}.`, 409);
      }

      const payoutRateBps = payload.payoutRatePercent === undefined ? before.payoutRateBps : Math.round(payload.payoutRatePercent * 100);
      if (!canChangeAffiliateRate(before.payoutRateBps, payoutRateBps, before.referredOrders)) {
        throw new AffiliateRouteError("Commission rate is locked after an affiliate has attributed orders.", 409);
      }

      const websiteAffiliate = await isWebsiteAffiliate(tx, payload.affiliateId);
      await tx.affiliate.update({
        where: { id: payload.affiliateId },
        data: {
          name: websiteAffiliate ? before.name : payload.name?.trim() ?? before.name,
          code: payload.code ?? before.code,
          affiliateType: websiteAffiliate ? "online" : payload.affiliateType ?? before.affiliateType,
          status: websiteAffiliate ? before.status : payload.status ?? before.status,
          revenueGeneratedCents: before.revenueGeneratedCents,
          payoutRateBps,
          totalPayoutCents: before.totalPayoutCents,
          payoutDueCents: before.payoutDueCents,
          referredCustomers: before.referredCustomers,
          referredOrders: before.referredOrders,
          lastPayoutAt: before.lastPayoutAt,
          notes: payload.notes ?? before.notes
        }
      });

      if (websiteAffiliate && payload.status) {
        await reviewWebsiteAffiliate(
          tx,
          payload.affiliateId,
          payload.status === "paused" ? "disabled" : "approved",
          payload.notes
        );
      }

      const after = await tx.affiliate.findUniqueOrThrow({ where: { id: payload.affiliateId } });
      const afterStatus = canonicalAffiliateStatus(after.status, after.archivedAt);

      const action = currentStatus === "pending" && afterStatus === "active"
        ? "AFFILIATE_APPROVED"
        : afterStatus === "paused"
          ? "AFFILIATE_PAUSED"
          : currentStatus === "paused" && afterStatus === "active"
            ? "AFFILIATE_RESUMED"
            : "AFFILIATE_UPDATED";
      await writeAuditLog({ actor, entityType: "AFFILIATE", entityId: after.id, action, before, after, request }, tx);
      return after;
    });

    invalidateOperationalDataCache();
    return NextResponse.json({ affiliate: await domainAffiliate(updated.id) });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const updated = updateOfflineAffiliate(payload.affiliateId, {
        name: payload.name,
        code: payload.code,
        affiliateType: payload.affiliateType,
        status: payload.status,
        revenueGeneratedCents: payload.revenueGeneratedCents,
        payoutRatePercent: payload.payoutRatePercent,
        totalPayoutCents: payload.totalPayoutCents,
        referredCustomers: payload.referredCustomers,
        referredOrders: payload.referredOrders,
        lastPayoutAt: payload.lastPayoutAt,
        notes: payload.notes
      });
      return updated
        ? NextResponse.json({ affiliate: updated })
        : NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  const actor = await requirePermission("settings:manage");
  const affiliateId = new URL(request.url).searchParams.get("affiliateId");
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!affiliateId) return NextResponse.json({ error: "affiliateId is required" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "A decline reason is required." }, { status: 400 });
  if (reason.length > 500) return NextResponse.json({ error: "Decline reason must be 500 characters or fewer." }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.affiliate.findUnique({ where: { id: affiliateId } });
      if (!before || before.archivedAt) throw new AffiliateRouteError("Affiliate not found", 404);
      if (canonicalAffiliateStatus(before.status, before.archivedAt) !== "pending") {
        throw new AffiliateRouteError("Only pending applications can be declined.", 409);
      }

      const websiteAffiliate = await isWebsiteAffiliate(tx, affiliateId);
      if (websiteAffiliate) {
        await reviewWebsiteAffiliate(tx, affiliateId, "rejected", reason);
      } else {
        await tx.affiliate.update({
          where: { id: affiliateId },
          data: {
            code: archiveAffiliateCode(before.code || "DECLINED", affiliateId),
            archivedAt: new Date(),
            status: "archived"
          }
        });
      }
      const after = await tx.affiliate.findUniqueOrThrow({ where: { id: affiliateId } });
      await writeAuditLog({
        actor,
        entityType: "AFFILIATE",
        entityId: affiliateId,
        action: "AFFILIATE_DECLINED",
        before,
        after,
        metadata: { reason, originalCode: before.code },
        request
      }, tx);
    });

    invalidateOperationalDataCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return deleteOfflineAffiliate(affiliateId)
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }
    return routeError(error);
  }
}
