import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { isReservedStage, isSoldStage, orderStageFromPersistence } from "@/lib/order-stage";

export type ReconciliationOrder = {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  items: Array<{ inventoryBatchId: string | null; quantity: number }>;
};

export type ReconciliationBatch = {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantitySold: number;
};

export function calculateInventoryReconciliation(orders: ReconciliationOrder[], batches: ReconciliationBatch[]) {
  const target = new Map<string, { reserved: number; sold: number }>();
  for (const order of orders) {
    const stage = orderStageFromPersistence(order);
    for (const item of order.items) {
      if (!item.inventoryBatchId) throw new Error("Every active order item must have an inventory batch before reconciliation.");
      const counts = target.get(item.inventoryBatchId) ?? { reserved: 0, sold: 0 };
      if (isReservedStage(stage)) counts.reserved += item.quantity;
      if (isSoldStage(stage)) counts.sold += item.quantity;
      target.set(item.inventoryBatchId, counts);
    }
  }

  const batchIds = new Set(batches.map((batch) => batch.id));
  for (const id of target.keys()) {
    if (!batchIds.has(id)) throw new Error(`Order inventory batch ${id} was not found.`);
  }

  return batches.map((batch) => {
    const desired = target.get(batch.id) ?? { reserved: 0, sold: 0 };
    const quantityOnHand = batch.quantityOnHand + batch.quantitySold - desired.sold;
    const quantityReserved = desired.reserved;
    const quantitySold = desired.sold;
    if (quantityOnHand < 0 || quantityReserved < 0 || quantityOnHand - quantityReserved < 0) {
      throw new Error(`Reconciliation would make inventory negative for batch ${batch.id}.`);
    }
    return {
      id: batch.id,
      before: batch,
      after: { quantityOnHand, quantityReserved, quantitySold },
      changed: quantityOnHand !== batch.quantityOnHand || quantityReserved !== batch.quantityReserved || quantitySold !== batch.quantitySold
    };
  });
}
