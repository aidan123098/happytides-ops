import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { createOfflineAffiliate, deleteOfflineAffiliate, isDatabaseUnavailable, updateOfflineAffiliate } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { getAffiliateById, getAffiliates, invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { affiliateInputSchema, affiliateUpdateSchema } from "@/lib/validation";

function validationError(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error.issues as Array<{ path: Array<string | number>; message: string }>) : [];
  const detail = issues[0] ? `${issues[0].path.join(".")}: ${issues[0].message}` : "Check the required fields and try again.";
  return NextResponse.json({ error: detail }, { status: 400 });
}

function payoutDueCents(revenueGeneratedCents: number, payoutRatePercent: number, totalPayoutCents: number) {
  const earned = Math.round((revenueGeneratedCents * payoutRatePercent) / 100);
  return Math.max(earned - totalPayoutCents, 0);
}

async function domainAffiliate(id: string) {
  return getAffiliateById(id);
}

export async function GET() {
  await requirePermission("reports:read");
  return NextResponse.json({ affiliates: await getAffiliates() });
}

export async function POST(request: Request) {
  const actor = await requirePermission("settings:manage");
  const body = await request.json();
  const parsed = affiliateInputSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;
  const payoutRatePercent = typeof body.payoutRatePercent === "number" ? payload.payoutRatePercent : payload.affiliateType === "wholesale" ? 15 : 20;
  try {
    const affiliate = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.affiliate.create({
        data: {
          name: payload.name,
          code: payload.code.trim().toUpperCase(),
          status: payload.status,
          revenueGeneratedCents: payload.revenueGeneratedCents,
          payoutRateBps: Math.round(payoutRatePercent * 100),
          totalPayoutCents: payload.totalPayoutCents,
          payoutDueCents: payoutDueCents(payload.revenueGeneratedCents, payoutRatePercent, payload.totalPayoutCents),
          referredCustomers: payload.referredCustomers,
          referredOrders: payload.referredOrders,
          lastPayoutAt: payload.lastPayoutAt ? new Date(payload.lastPayoutAt) : null,
          notes: payload.notes
        }
      });

      await writeAuditLog({ actor, entityType: "AFFILIATE", entityId: created.id, action: "CREATE", after: created, request }, tx);
      return created;
    });

    invalidateOperationalDataCache();
    return NextResponse.json({ affiliate: await domainAffiliate(affiliate.id) }, { status: 201 });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    const affiliate = createOfflineAffiliate({
      name: payload.name,
      code: payload.code,
      affiliateType: payload.affiliateType,
      status: payload.status,
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
}

export async function PATCH(request: Request) {
  const actor = await requirePermission("settings:manage");
  const parsed = affiliateUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;
  const updated = await (async () => {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const before = await tx.affiliate.findUnique({ where: { id: payload.affiliateId } });
        if (!before || before.archivedAt) return null;
        const rate = payload.payoutRatePercent ?? before.payoutRateBps / 100;
        const revenue = payload.revenueGeneratedCents ?? before.revenueGeneratedCents;
        const paid = payload.totalPayoutCents ?? before.totalPayoutCents;
        const after = await tx.affiliate.update({
          where: { id: payload.affiliateId },
          data: {
            name: payload.name ?? before.name,
            code: payload.code ? payload.code.trim().toUpperCase() : before.code,
            status: payload.status ?? before.status,
            revenueGeneratedCents: revenue,
            payoutRateBps: Math.round(rate * 100),
            totalPayoutCents: paid,
            payoutDueCents: payoutDueCents(revenue, rate, paid),
            referredCustomers: payload.referredCustomers ?? before.referredCustomers,
            referredOrders: payload.referredOrders ?? before.referredOrders,
            lastPayoutAt: payload.lastPayoutAt ? new Date(payload.lastPayoutAt) : before.lastPayoutAt,
            notes: payload.notes ?? before.notes
          }
        });

        await writeAuditLog({ actor, entityType: "AFFILIATE", entityId: after.id, action: "UPDATE", before, after, request }, tx);
        return after;
      });
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      return updateOfflineAffiliate(payload.affiliateId, {
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
    }
  })();

  if (!updated) {
    return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  }

  invalidateOperationalDataCache();
  return NextResponse.json({ affiliate: await domainAffiliate(updated.id) });
}

export async function DELETE(request: Request) {
  const actor = await requirePermission("settings:manage");
  const affiliateId = new URL(request.url).searchParams.get("affiliateId");

  if (!affiliateId) {
    return NextResponse.json({ error: "affiliateId is required" }, { status: 400 });
  }

  const archived = await (async () => {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const before = await tx.affiliate.findUnique({ where: { id: affiliateId } });
        if (!before || before.archivedAt) return null;
        const after = await tx.affiliate.update({ where: { id: affiliateId }, data: { archivedAt: new Date(), status: "archived" } });
        await writeAuditLog({ actor, entityType: "AFFILIATE", entityId: affiliateId, action: "ARCHIVE", before, after, request }, tx);
        return after;
      });
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      return deleteOfflineAffiliate(affiliateId) ? { id: affiliateId } : null;
    }
  })();

  if (!archived) {
    return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  }

  invalidateOperationalDataCache();
  return NextResponse.json({ ok: true });
}
