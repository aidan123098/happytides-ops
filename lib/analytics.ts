import { customers, inventoryBatches, orders, products, revenueSeries } from "@/lib/seed-data";

export function getAnalyticsSummary() {
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const revenueCents = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const grossMarginCents = products.reduce((sum, product) => {
    return sum + (product.priceCents - product.costOfGoodsCents) * product.unitsSoldWeek;
  }, 0);
  const unitsSold = paidOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );

  return {
    revenueCents,
    netRevenueCents: revenueCents,
    grossMarginCents,
    unitsSold,
    repeatPurchaseRate: 0,
    averageDaysBetweenPurchases: 0,
    dormantCustomers: customers.filter((customer) => customer.status === "inactive"),
    topCustomers: [...customers].sort((a, b) => b.totalSpendCents - a.totalSpendCents).slice(0, 5),
    lowStock: inventoryBatches.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand - batch.quantityReserved <= batch.reorderThreshold),
    expiringSoon: inventoryBatches.filter((batch) => new Date(batch.expirationDate) < new Date("2026-11-01")),
    revenueSeries
  };
}
