import assert from "node:assert/strict";
import { test } from "node:test";
import { InventoryStatus } from "@prisma/client";
import { assertLotCanAllocate, type AllocationLot } from "@/lib/services/inventory-policy";

const baseLot: AllocationLot = {
  productId: "prod_a",
  status: InventoryStatus.AVAILABLE,
  expirationDate: new Date("2099-01-01T00:00:00.000Z"),
  quantityOnHand: 10,
  quantityReserved: 2
};

test("allows allocation when lot is available and has sufficient stock", () => {
  assert.doesNotThrow(() => assertLotCanAllocate(baseLot, { productId: "prod_a", quantity: 8 }));
});

test("blocks allocation from a lot belonging to another product", () => {
  assert.throws(() => assertLotCanAllocate(baseLot, { productId: "prod_b", quantity: 1 }), /does not belong/);
});

test("blocks allocation from unavailable lot statuses", () => {
  assert.throws(
    () => assertLotCanAllocate({ ...baseLot, status: InventoryStatus.QUARANTINED }, { productId: "prod_a", quantity: 1 }),
    /not available/
  );
});

test("blocks allocation from expired lots", () => {
  assert.throws(
    () =>
      assertLotCanAllocate(
        { ...baseLot, expirationDate: new Date("2026-01-01T00:00:00.000Z") },
        { productId: "prod_a", quantity: 1 },
        new Date("2026-07-05T00:00:00.000Z")
      ),
    /Expired/
  );
});

test("blocks overselling when reserved quantity reduces availability", () => {
  assert.throws(() => assertLotCanAllocate(baseLot, { productId: "prod_a", quantity: 9 }), /Insufficient/);
});
