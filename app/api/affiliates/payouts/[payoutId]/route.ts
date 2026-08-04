import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateOperationalDataCache } from "@/lib/services/operational-data";

type PayoutRow = {
  id: string;
  affiliateId: string;
  amountCents: number;
  status: string;
  externalReference: string | null;
  paidAt: Date | null;
};

async function payoutRow(tx: Prisma.TransactionClient, payoutId: string) {
  const rows = await tx.$queryRaw<PayoutRow[]>`
    SELECT
      id::text,
      affiliate_id AS "affiliateId",
      amount_cents AS "amountCents",
      status,
      external_reference AS "externalReference",
      paid_at AS "paidAt"
    FROM storefront.affiliate_payouts
    WHERE id = ${payoutId}::uuid
  `;
  return rows[0];
}

export async function PATCH(request: Request, context: { params: Promise<{ payoutId: string }> }) {
  const actor = await requirePermission("settings:manage");
  const { payoutId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const externalReference = typeof body.externalReference === "string" ? body.externalReference.trim() : "";
  if (!externalReference) return NextResponse.json({ error: "A payment reference is required." }, { status: 400 });
  if (externalReference.length > 255) return NextResponse.json({ error: "Payment reference must be 255 characters or fewer." }, { status: 400 });

  try {
    const after = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1::int AS "lockAcquired" FROM pg_advisory_xact_lock(hashtext(${`affiliate-payout:${payoutId}`}))`;
      const before = await payoutRow(tx, payoutId);
      if (!before) throw new Error("Payout was not found.");
      if (before.status === "paid") throw new Error("This payout has already been recorded as paid.");

      await tx.$queryRaw`
        SELECT public.mark_storefront_payout_paid(${payoutId}::uuid, ${externalReference})
      `;
      const paid = await payoutRow(tx, payoutId);
      if (!paid) throw new Error("Payout was not found after payment.");
      await writeAuditLog({
        actor,
        entityType: "AFFILIATE",
        entityId: paid.affiliateId,
        action: "AFFILIATE_PAYOUT_PAID",
        before,
        after: paid,
        metadata: { payoutId, amountCents: paid.amountCents, externalReference },
        request
      }, tx);
      return paid;
    });
    invalidateOperationalDataCache();
    return NextResponse.json({ payout: after });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payout could not be recorded.";
    return NextResponse.json({ error: message }, { status: message.includes("already") ? 409 : 400 });
  }
}
