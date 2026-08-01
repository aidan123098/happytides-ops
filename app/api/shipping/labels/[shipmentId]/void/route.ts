import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { voidShippingLabel } from "@/lib/services/shipping";

export async function PUT(request: Request, context: { params: Promise<{ shipmentId: string }> }) {
  const actor = await requirePermission("orders:manage");
  const { shipmentId } = await context.params;
  try {
    await voidShippingLabel(shipmentId, actor, request);
    invalidateOperationalDataCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The label could not be voided." }, { status: 400 });
  }
}
