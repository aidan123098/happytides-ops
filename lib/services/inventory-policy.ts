import { InventoryStatus } from "@prisma/client";

export type AllocationLot = {
  productId: string;
  status: InventoryStatus;
  expirationDate: Date;
  quantityOnHand: number;
  quantityReserved: number;
};

export type AllocationRequest = {
  productId: string;
  quantity: number;
};

export function adjustedInventoryTotal(quantityOnHand: number, quantityReserved: number, quantityDelta: number) {
  const quantityAfter = quantityOnHand + quantityDelta;

  if (quantityAfter < 0) {
    throw new Error("Inventory cannot go negative.");
  }

  if (quantityAfter < quantityReserved) {
    throw new Error("Inventory total cannot be lower than reserved (paid) stock.");
  }

  return quantityAfter;
}

export function assertLotCanAllocate(batch: AllocationLot, requested: AllocationRequest, now = new Date()) {
  const allowedStatuses: InventoryStatus[] = [InventoryStatus.AVAILABLE, InventoryStatus.QA_RELEASED, InventoryStatus.RECEIVED];

  if (batch.productId !== requested.productId) {
    throw new Error("Selected lot does not belong to the selected product.");
  }

  if (!allowedStatuses.includes(batch.status)) {
    throw new Error("Selected lot is not available for allocation.");
  }

  if (batch.expirationDate < now && batch.expirationDate.getFullYear() < 2099) {
    throw new Error("Expired lots cannot be allocated.");
  }

  if (batch.quantityOnHand - batch.quantityReserved < requested.quantity) {
    throw new Error("Insufficient available inventory for selected lot.");
  }
}
