type OrderTotalItem = {
  unitPriceCents: number;
  quantity: number;
  discountCents: number;
};

export function calculateOrderTotals(items: OrderTotalItem[], deliveryMethod: "ship" | "pickup", requestedShippingCents = 0) {
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const discountCents = items.reduce((sum, item) => sum + item.discountCents, 0);
  const shippingCents = deliveryMethod === "ship" ? Math.max(requestedShippingCents, 0) : 0;

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: subtotalCents - discountCents + shippingCents
  };
}
