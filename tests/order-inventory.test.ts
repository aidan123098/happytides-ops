import assert from "node:assert/strict";
import { test } from "node:test";
import { FulfillmentStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { transitionInventoryCounts } from "@/lib/inventory-counts";
import { calculateInventoryReconciliation } from "@/lib/inventory-reconciliation";
import { orderStageFromPersistence, persistenceForOrderStage } from "@/lib/order-stage";

test("maps the five public statuses to existing persistence enums", () => {
  for (const stage of ["unfulfilled", "paid", "packed", "shipped", "delivered"] as const) {
    assert.equal(orderStageFromPersistence(persistenceForOrderStage(stage)), stage);
  }
});

test("paid reserves stock and packed converts it to sold", () => {
  const paid = transitionInventoryCounts(
    { quantityOnHand: 100, quantityReserved: 0, quantitySold: 0 },
    { reserved: 0, sold: 0 },
    { reserved: 10, sold: 0 }
  );
  assert.deepEqual(paid.counts, { quantityOnHand: 100, quantityReserved: 10, quantitySold: 0 });

  const packed = transitionInventoryCounts(paid.counts, { reserved: 10, sold: 0 }, { reserved: 0, sold: 10 });
  assert.deepEqual(packed.counts, { quantityOnHand: 90, quantityReserved: 0, quantitySold: 10 });
});

test("shipped and delivered do not sell the same units twice", () => {
  const current = { quantityOnHand: 90, quantityReserved: 0, quantitySold: 10 };
  const shipped = transitionInventoryCounts(current, { reserved: 0, sold: 10 }, { reserved: 0, sold: 10 });
  assert.deepEqual(shipped.counts, current);
});

test("reverse status changes restore physical and reserved stock exactly", () => {
  const paid = transitionInventoryCounts(
    { quantityOnHand: 90, quantityReserved: 0, quantitySold: 10 },
    { reserved: 0, sold: 10 },
    { reserved: 10, sold: 0 }
  );
  assert.deepEqual(paid.counts, { quantityOnHand: 100, quantityReserved: 10, quantitySold: 0 });
  const unfulfilled = transitionInventoryCounts(paid.counts, { reserved: 10, sold: 0 }, { reserved: 0, sold: 0 });
  assert.deepEqual(unfulfilled.counts, { quantityOnHand: 100, quantityReserved: 0, quantitySold: 0 });
});

test("blocks a transition that would make available inventory negative", () => {
  assert.throws(
    () => transitionInventoryCounts({ quantityOnHand: 5, quantityReserved: 0, quantitySold: 0 }, { reserved: 0, sold: 0 }, { reserved: 6, sold: 0 }),
    /Insufficient/
  );
});

test("reconciliation derives reserved and sold directly from active order stages", () => {
  const orders = [
    { status: OrderStatus.PAID, paymentStatus: PaymentStatus.PAID, fulfillmentStatus: FulfillmentStatus.UNFULFILLED, items: [{ inventoryBatchId: "batch", quantity: 4 }] },
    { status: OrderStatus.READY_TO_SHIP, paymentStatus: PaymentStatus.PAID, fulfillmentStatus: FulfillmentStatus.PACKED, items: [{ inventoryBatchId: "batch", quantity: 3 }] },
    { status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID, fulfillmentStatus: FulfillmentStatus.FULFILLED, items: [{ inventoryBatchId: "batch", quantity: 2 }] }
  ];
  const [row] = calculateInventoryReconciliation(orders, [{ id: "batch", quantityOnHand: 98, quantityReserved: 7, quantitySold: 2 }]);
  assert.deepEqual(row.after, { quantityOnHand: 95, quantityReserved: 4, quantitySold: 5 });
});
