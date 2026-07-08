import Link from "next/link";
import { CheckCircle2, ClipboardList, PackageCheck, Plus, ReceiptText, Truck } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { OrdersWorkbench } from "@/components/orders-workbench";
import { PageHeader } from "@/components/page-header";
import { getInventoryBatches, getOrders, getProducts } from "@/lib/services/operational-data";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [inventoryBatches, orders, products] = await Promise.all([getInventoryBatches(), getOrders(), getProducts()]);
  const visibleOrders = orders.filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled");
  const now = new Date();
  const todayOrders = visibleOrders.filter((order) => {
    const date = new Date(order.createdAt);
    return !Number.isNaN(date.getTime()) && date.toDateString() === now.toDateString();
  });
  const pendingPayments = visibleOrders.filter((order) => order.paymentStatus === "pending").length;
  const unfulfilled = visibleOrders.filter((order) => order.fulfillmentStatus === "unfulfilled").length;
  const packed = visibleOrders.filter((order) => order.fulfillmentStatus === "packed").length;
  const shipped = visibleOrders.filter((order) => order.fulfillmentStatus === "shipped").length;
  const delivered = visibleOrders.filter((order) => order.fulfillmentStatus === "delivered" || order.fulfillmentStatus === "fulfilled").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales processing"
        title="Orders"
        description="Record orders, track payment, and keep fulfillment moving from packing to delivery."
        icon={ClipboardList}
        kicker={`${formatNumber(visibleOrders.length)} active orders`}
        stats={[
          { label: "Orders today", value: formatNumber(todayOrders.length), detail: "Created today", icon: ClipboardList, tone: todayOrders.length > 0 ? "blue" : "slate" },
          { label: "Unfulfilled", value: formatNumber(unfulfilled), detail: "Needs first action", icon: ReceiptText, tone: unfulfilled > 0 ? "amber" : "green" },
          { label: "Packed", value: formatNumber(packed), detail: "Ready to ship", icon: PackageCheck, tone: packed > 0 ? "blue" : "slate" },
          { label: "Shipped", value: formatNumber(shipped), detail: "In transit", icon: Truck, tone: shipped > 0 ? "blue" : "slate" }
        ]}
        actions={
          <Link
            href="/orders/new?returnTo=%2Forders"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Plus size={16} />
            New order
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
        <MetricCard featured title="Active orders" value={formatNumber(visibleOrders.length)} detail={`${formatNumber(todayOrders.length)} created today`} icon={ClipboardList} tone="blue" />
        <MetricCard title="Unfulfilled" value={formatNumber(unfulfilled)} detail="Needs first action" icon={ReceiptText} tone={unfulfilled > 0 ? "amber" : "green"} />
        <MetricCard title="Packed" value={formatNumber(packed)} detail="Ready to ship" icon={PackageCheck} tone={packed > 0 ? "blue" : "slate"} />
        <MetricCard title="Shipped" value={formatNumber(shipped)} detail="In transit" icon={Truck} tone={shipped > 0 ? "blue" : "slate"} />
        <MetricCard title="Delivered" value={formatNumber(delivered)} detail="Completed orders" icon={CheckCircle2} tone={delivered > 0 ? "green" : "slate"} />
        <MetricCard title="Payment queue" value={formatNumber(pendingPayments)} detail="Needs collection" icon={ReceiptText} tone={pendingPayments > 0 ? "amber" : "green"} />
      </section>

      <OrdersWorkbench initialOrders={orders} initialProducts={products} initialInventoryBatches={inventoryBatches} />
    </div>
  );
}
