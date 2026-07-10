export type InventoryCounts = {
  quantityOnHand: number;
  quantityReserved: number;
  quantitySold: number;
};

export type OrderAllocation = {
  reserved: number;
  sold: number;
};

export function transitionInventoryCounts(current: InventoryCounts, previous: OrderAllocation, next: OrderAllocation) {
  const reservedDelta = next.reserved - previous.reserved;
  const soldDelta = next.sold - previous.sold;
  const counts = {
    quantityOnHand: current.quantityOnHand - soldDelta,
    quantityReserved: current.quantityReserved + reservedDelta,
    quantitySold: current.quantitySold + soldDelta
  };

  if (counts.quantityOnHand < 0 || counts.quantityReserved < 0 || counts.quantitySold < 0 || counts.quantityOnHand - counts.quantityReserved < 0) {
    throw new Error("Insufficient available inventory for selected lot.");
  }

  return { counts, reservedDelta, soldDelta };
}
