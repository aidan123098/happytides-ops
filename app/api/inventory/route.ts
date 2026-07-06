import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getLocalStore } from "@/lib/local-store";
import { adjustOfflineInventory, isDatabaseUnavailable } from "@/lib/offline-store";
import { getInventoryBatches } from "@/lib/services/operational-data";
import { adjustInventory } from "@/lib/services/operations";
import { inventoryAdjustmentSchema } from "@/lib/validation";

export async function GET() {
  await requirePermission("inventory:read");
  const store = await getLocalStore();
  return NextResponse.json({ batches: store.inventoryBatches, movements: store.inventoryMovements });
}

export async function POST(request: Request) {
  const actor = await requirePermission("inventory:manage");
  const payload = inventoryAdjustmentSchema.parse(await request.json());

  try {
    const batch = await adjustInventory(payload, actor, request);
    const domainBatch = (await getInventoryBatches()).find((item) => item.id === batch.id);
    return NextResponse.json({ batch: domainBatch ?? batch });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const batch = adjustOfflineInventory(payload, actor);
      return NextResponse.json({ batch });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Inventory adjustment failed." }, { status: 400 });
  }
}
