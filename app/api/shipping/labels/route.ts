import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { purchaseShippingLabel } from "@/lib/services/shipping";
import { shippingLabelPurchaseSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const actor = await requirePermission("orders:manage");
  const parsed = shippingLabelPurchaseSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Select a shipping rate." }, { status: 400 });
  try {
    const result = await purchaseShippingLabel(parsed.data, actor, request);
    invalidateOperationalDataCache();
    return NextResponse.json({
      shipment: {
        id: result.shipment.id,
        status: result.shipment.status.toLowerCase(),
        trackingNumber: result.shipment.trackingNumber
      },
      pending: result.pending
    }, { status: result.pending ? 202 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The label could not be purchased." }, { status: 400 });
  }
}
