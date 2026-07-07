import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, ClipboardList, History, PackageCheck, Timer } from "lucide-react";
import { DataTable, Td } from "@/components/data-table";
import { InventoryWorkbench } from "@/components/inventory-workbench";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { inventoryBatches, inventoryMovements, orders, products } = await getLocalStore();
  const totalOnHand = inventoryBatches.reduce((sum, batch) => sum + batch.quantityOnHand, 0);
  const reserved = inventoryBatches.reduce((sum, batch) => sum + batch.quantityReserved, 0);
  const lowStock = inventoryBatches.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold);
  const expiringSoon = inventoryBatches.filter((batch) => {
    const expires = new Date(batch.expirationDate);
    return !Number.isNaN(expires.getTime()) && expires.getTime() <= Date.now() + 1000 * 60 * 60 * 24 * 90;
  });
  const inventoryValue = inventoryBatches.reduce((sum, batch) => sum + batch.quantityOnHand * batch.costPerVialCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory control"
        title="Batch inventory cockpit"
        description="Lot-level stock control for on-hand quantity, reserves, expiration exposure, supplier records, COAs, receiving, and adjustment history."
        icon={Boxes}
        kicker={`${formatNumber(products.filter((product) => product.active).length)} tracked SKUs`}
        stats={[
          { label: "On hand", value: formatNumber(totalOnHand), detail: `${formatNumber(reserved)} units currently reserved`, icon: PackageCheck, tone: "green" },
          { label: "Low stock", value: formatNumber(lowStock.length), detail: "Batches at or below threshold", icon: AlertTriangle, tone: lowStock.length > 0 ? "amber" : "green" },
          { label: "Expiring soon", value: formatNumber(expiringSoon.length), detail: "Lots inside the 90-day review window", icon: Timer, tone: expiringSoon.length > 0 ? "amber" : "green" },
          { label: "Stock value", value: formatCurrency(inventoryValue, 0), detail: "Estimated on-hand cost basis", icon: CircleDollarSign, tone: "blue" }
        ]}
        actions={
          <>
            <Link
              href="#inventory-workbench"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <ClipboardList size={16} />
              Manage batches
            </Link>
            <Link
              href="#inventory-audit"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <History size={16} />
              Movement audit
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <MetricCard featured title="On hand" value={formatNumber(totalOnHand)} detail={`${formatNumber(reserved)} reserved units`} icon={PackageCheck} tone="green" />
        <MetricCard title="Low stock" value={formatNumber(lowStock.length)} detail="Batches at threshold" icon={AlertTriangle} tone={lowStock.length > 0 ? "amber" : "green"} />
        <MetricCard title="Expiring soon" value={formatNumber(expiringSoon.length)} detail="Lots inside 90 days" icon={Timer} tone={expiringSoon.length > 0 ? "amber" : "green"} />
        <MetricCard title="Inventory value" value={formatCurrency(inventoryValue, 0)} detail="Estimated on-hand cost" icon={CircleDollarSign} tone="blue" />
        <MetricCard title="Active products" value={formatNumber(products.filter((product) => product.active).length)} detail="Catalog items tracked" icon={Boxes} tone="slate" />
      </section>

      <div id="inventory-workbench">
        <InventoryWorkbench initialBatches={inventoryBatches} products={products} orders={orders} />
      </div>

      <Card id="inventory-audit">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Boxes size={17} className="text-blue-700" />
            <CardTitle>Inventory movement audit</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={["Time", "Product", "Batch", "Type", "Change", "Reason", "User"]}>
            {inventoryMovements.map((movement) => (
              <tr key={movement.id}>
                <Td>{movement.at}</Td>
                <Td className="font-medium text-slate-950">{movement.product}</Td>
                <Td className="font-mono text-xs">{movement.batch}</Td>
                <Td><Badge tone={movement.type === "sold" ? "blue" : movement.type === "received" ? "green" : "amber"}>{movement.type}</Badge></Td>
                <Td className={movement.delta < 0 ? "text-red-600" : "text-emerald-700"}>{movement.delta}</Td>
                <Td>{movement.reason}</Td>
                <Td>{movement.staff}</Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
