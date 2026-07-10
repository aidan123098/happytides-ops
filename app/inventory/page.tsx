import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, ClipboardList, PackageCheck } from "lucide-react";
import { DataTable, Td } from "@/components/data-table";
import { InventoryWorkbench } from "@/components/inventory-workbench";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { paymentRecipientLabel, paymentRecipientLabels, paymentRecipients } from "@/lib/payment-recipients";
import { getInventoryBatches, getInventoryMovements, getOrders, getProducts } from "@/lib/services/operational-data";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function movementTone(type: string) {
  const normalized = type.toLowerCase();

  if (normalized.includes("sold") || normalized.includes("fulfillment") || normalized.includes("allocation")) return "blue";
  if (normalized.includes("received") || normalized.includes("receipt") || normalized.includes("release") || normalized.includes("return")) return "green";
  if (normalized.includes("damage") || normalized.includes("quarantine") || normalized.includes("recall") || normalized.includes("destruction") || normalized.includes("expired")) return "amber";
  return "slate";
}

function movementLabel(type: string) {
  return type.replaceAll("_", " ").toLowerCase();
}

function isPaymentTrackedStatus(status: string) {
  return status === "paid" || status === "packed" || status === "shipped" || status === "delivered";
}

export default async function InventoryPage() {
  const [inventoryBatches, inventoryMovements, orders, products] = await Promise.all([getInventoryBatches(), getInventoryMovements(), getOrders(), getProducts()]);
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
  const assignedPaymentTotal = paymentRecipients.reduce((sum, recipient) => sum + (paymentSummary.get(recipient)?.totalCents ?? 0), 0);

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

      <div className="border-t border-slate-200 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Movement history</h2>
        <p className="mt-1 text-sm text-slate-500">Recent stock changes, reservations, receipts, and adjustments.</p>
      </div>

      <Card id="inventory-audit">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Boxes size={17} className="text-blue-700" />
            <CardTitle>Inventory movement audit</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {inventoryMovements.map((movement) => (
              <div key={movement.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{movement.product}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{movement.batch}</div>
                  </div>
                  <Badge tone={movementTone(movement.type)}>{movementLabel(movement.type)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">Change</div>
                    <div className={movement.delta < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{movement.delta}</div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">User</div>
                    <div className="font-semibold text-slate-950">{movement.staff}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-600">{movement.reason}</div>
                <div className="mt-2 text-xs font-medium text-slate-500">{movement.at}</div>
              </div>
            ))}
          </div>

          <DataTable className="hidden md:block" columns={["Time", "Product", "Batch", "Type", "Change", "Reason", "User"]}>
            {inventoryMovements.map((movement) => (
              <tr key={movement.id}>
                <Td>{movement.at}</Td>
                <Td className="font-medium text-slate-950">{movement.product}</Td>
                <Td className="font-mono text-xs">{movement.batch}</Td>
                <Td><Badge tone={movementTone(movement.type)}>{movementLabel(movement.type)}</Badge></Td>
                <Td className={movement.delta < 0 ? "text-red-600" : "text-emerald-700"}>{movement.delta}</Td>
                <Td>{movement.reason}</Td>
                <Td>{movement.staff}</Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700 marker:hidden">
              <span>Who got paid totals</span>
              <span className="text-xs font-medium text-slate-500">{formatCurrency(assignedPaymentTotal)} assigned</span>
            </summary>
            <div className="border-t border-slate-200 px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {paymentRecipients.map((recipient) => {
                  const row = paymentSummary.get(recipient) ?? { totalCents: 0, orders: [] };
                  return (
                    <details key={recipient} className="rounded-md border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer list-none p-3 marker:hidden">
                        <div className="text-xs font-semibold uppercase text-slate-500">{paymentRecipientLabels[recipient]}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(row.totalCents)}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatNumber(row.orders.length)} paid-or-later orders</div>
                      </summary>
                      <div className="space-y-2 border-t border-slate-200 px-3 py-2">
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
                    {paymentRecipientLabel(null)}: {formatCurrency(paymentSummary.get("unassigned")?.totalCents ?? 0)} across {formatNumber(paymentSummary.get("unassigned")?.orders.length ?? 0)} paid-or-later orders.
                  </summary>
                  <div className="space-y-2 border-t border-amber-200 px-3 py-2">
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
