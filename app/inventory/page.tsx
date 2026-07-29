import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, ClipboardList, PackageCheck } from "lucide-react";
import { InventoryMovementAudit } from "@/components/inventory-movement-audit";
import { InventoryWorkbench } from "@/components/inventory-workbench";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { paymentRecipientLabel, paymentRecipientLabels, paymentRecipients } from "@/lib/payment-recipients";
import { getInventoryBatches, getInventoryMovements, getOrders, getProducts } from "@/lib/services/operational-data";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function isPaymentTrackedStatus(status: string) {
  return status === "paid" || status === "packed" || status === "shipped" || status === "delivered";
}

export default async function InventoryPage() {
  const [inventoryBatches, orderMovements, stockMovements, orders, products] = await Promise.all([
    getInventoryBatches(),
    getInventoryMovements("order"),
    getInventoryMovements("stock"),
    getOrders(),
    getProducts()
  ]);
  const totalOnHand = inventoryBatches.reduce((sum, batch) => sum + batch.quantityOnHand, 0);
  const reserved = inventoryBatches.reduce((sum, batch) => sum + batch.quantityReserved, 0);
  const lowStock = inventoryBatches.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand - batch.quantityReserved <= batch.reorderThreshold);
  const inventoryValue = inventoryBatches.reduce((sum, batch) => sum + batch.quantityOnHand * batch.costPerVialCents, 0);
  const paymentSummary = orders
    .filter((order) => order.orderNumber !== "N/A" && isPaymentTrackedStatus(order.status) && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled")
    .reduce((summary, order) => {
      const key = order.paidTo ?? "unassigned";
      const current = summary.get(key) ?? { totalCents: 0, orders: [] as typeof orders };
      current.totalCents += order.totalCents;
      current.orders.push(order);
      summary.set(key, current);
      return summary;
    }, new Map<string, { totalCents: number; orders: typeof orders }>());
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory control"
        title="Inventory"
        description="Track total stock, paid reservations, receipts, adjustments, and movement history."
        icon={Boxes}
        kicker={`${formatNumber(products.filter((product) => product.active).length)} tracked SKUs`}
        stats={[
          { label: "Total", value: formatNumber(totalOnHand), detail: `${formatNumber(reserved)} units reserved (paid)`, icon: PackageCheck, tone: "green" },
          { label: "Low stock", value: formatNumber(lowStock.length), detail: "Stock counts at or below threshold", icon: AlertTriangle, tone: lowStock.length > 0 ? "amber" : "green" },
          { label: "Stock value", value: formatCurrency(inventoryValue, 0), detail: "Estimated current inventory cost", icon: CircleDollarSign, tone: "blue" }
        ]}
        actions={
          <Link
            href="#inventory-workbench"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <ClipboardList size={16} />
            Manage stock
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard featured title="Total" value={formatNumber(totalOnHand)} detail={`${formatNumber(reserved)} reserved (paid)`} icon={PackageCheck} tone="green" />
        <MetricCard title="Low stock" value={formatNumber(lowStock.length)} detail="Stock counts at threshold" icon={AlertTriangle} tone={lowStock.length > 0 ? "amber" : "green"} />
        <MetricCard title="Inventory value" value={formatCurrency(inventoryValue, 0)} detail="Estimated current inventory cost" icon={CircleDollarSign} tone="blue" />
        <MetricCard title="Active products" value={formatNumber(products.filter((product) => product.active).length)} detail="Catalog items tracked" icon={Boxes} tone="slate" />
      </section>

      <div id="inventory-workbench">
        <InventoryWorkbench initialBatches={inventoryBatches} products={products} orders={orders} />
      </div>

      <InventoryMovementAudit initialOrderMovements={orderMovements} initialStockMovements={stockMovements} />

      <Card>
        <CardContent className="p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700 marker:hidden">
              <span>Who got paid totals</span>
            </summary>
            <div className="border-t border-slate-200 px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {paymentRecipients.map((recipient) => {
                  const row = paymentSummary.get(recipient) ?? { totalCents: 0, orders: [] };
                  return (
                    <details key={recipient} className="rounded-md border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer list-none p-3 marker:hidden">
                        <div className="text-xs font-semibold uppercase text-slate-500">{paymentRecipientLabels[recipient]}</div>
                      </summary>
                      <div className="space-y-2 border-t border-slate-200 px-3 py-2">
                        <div className="flex items-end justify-between gap-2 rounded-md bg-white px-2 py-1.5">
                          <div>
                            <div className="text-xs text-slate-500">Total paid</div>
                            <div className="text-lg font-semibold text-slate-950">{formatCurrency(row.totalCents)}</div>
                          </div>
                          <div className="pb-0.5 text-right text-xs text-slate-500">{formatNumber(row.orders.length)} paid-or-later orders</div>
                        </div>
                        {row.orders.length > 0 ? row.orders.map((order) => (
                          <div key={order.id} className="rounded-md bg-white px-2 py-1.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-950">{order.customerName}</span>
                              <span className="font-medium text-slate-700">{formatCurrency(order.totalCents)}</span>
                            </div>
                            <div className="mt-0.5 text-slate-500">{order.orderNumber} / {order.status}</div>
                          </div>
                        )) : (
                          <div className="rounded-md bg-white px-2 py-1.5 text-xs text-slate-500">No paid orders assigned.</div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
              {paymentSummary.has("unassigned") ? (
                <details className="mt-2 rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-800">
                  <summary className="cursor-pointer list-none px-3 py-2 marker:hidden">
                    {paymentRecipientLabel(null)}
                  </summary>
                  <div className="space-y-2 border-t border-amber-200 px-3 py-2">
                    <div className="flex items-end justify-between gap-2 rounded-md bg-white/80 px-2 py-1.5">
                      <div>
                        <div className="text-xs text-amber-700">Total unassigned</div>
                        <div className="text-lg font-semibold text-slate-950">{formatCurrency(paymentSummary.get("unassigned")?.totalCents ?? 0)}</div>
                      </div>
                      <div className="pb-0.5 text-right text-xs text-amber-700">{formatNumber(paymentSummary.get("unassigned")?.orders.length ?? 0)} paid-or-later orders</div>
                    </div>
                    {paymentSummary.get("unassigned")?.orders.map((order) => (
                      <div key={order.id} className="rounded-md bg-white/80 px-2 py-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-950">{order.customerName}</span>
                          <span className="font-medium text-slate-700">{formatCurrency(order.totalCents)}</span>
                        </div>
                        <div className="mt-0.5 text-slate-500">{order.orderNumber} / {order.status}</div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
