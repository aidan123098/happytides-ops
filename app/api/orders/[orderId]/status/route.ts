import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { isDatabaseUnavailable } from "@/lib/offline-store";
import { getInventoryBatchesByIds, invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { changeOrderStatus } from "@/lib/services/operations";
import { orderStatusUpdateSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const actor = await requirePermission("orders:manage");
  const parsed = orderStatusUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });

  try {
    const { orderId } = await context.params;
    const result = await changeOrderStatus(orderId, parsed.data.status, actor, request);
    invalidateOperationalDataCache();
    const batches = await getInventoryBatchesByIds(result.changedBatchIds);
    return NextResponse.json({ order: { id: orderId, status: parsed.data.status }, batches });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "The shared database is unavailable. Try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order status could not be updated." }, { status: 400 });
  }
}
