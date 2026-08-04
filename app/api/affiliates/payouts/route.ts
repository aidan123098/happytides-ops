import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateOperationalDataCache } from "@/lib/services/operational-data";

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : value;
}

export async function POST(request: Request) {
  const actor = await requirePermission("settings:manage");
  const body = await request.json().catch(() => ({}));
  const asOf = body.asOf === undefined ? new Date().toISOString().slice(0, 10) : validDate(body.asOf);
  if (!asOf) return NextResponse.json({ error: "Use a valid payout date." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ payload: { created?: number; periodStart?: string; periodEnd?: string } }>>`
        SELECT public.prepare_storefront_payouts(${asOf}::date) AS payload
      `;
      const payload = rows[0]?.payload ?? {};
      await writeAuditLog({
        actor,
        entityType: "AFFILIATE",
        entityId: "monthly-payouts",
        action: "AFFILIATE_PAYOUTS_PREPARED",
        metadata: payload,
        request
      }, tx);
      return payload;
    });
    invalidateOperationalDataCache();
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payouts could not be prepared." }, { status: 400 });
  }
}
