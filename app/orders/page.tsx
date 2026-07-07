import Link from "next/link";
import { BadgeDollarSign, BarChart3, ClipboardList, PackageCheck, Plus, ReceiptText, Truck } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { OrdersWorkbench } from "@/components/orders-workbench";
import { PageHeader } from "@/components/page-header";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { inventoryBatches, orders, products } = await getLocalStore();
  const visibleOrders = orders.filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled");
  const paidOrders = visibleOrders.filter((order) => order.paymentStatus === "paid");
  const now = new Date();
  const todayOrders = paidOrders.filter((order) => {
    const date = new Date(order.createdAt);
    return !Number.isNaN(date.getTime()) && date.toDateString() === now.toDateString();
  });
  const revenueToday = todayOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const unitsToday = todayOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const pendingPayments = visibleOrders.filter((order) => order.paymentStatus === "pending").length;
  const openFulfillment = visibleOrders.filter((order) => order.fulfillmentStatus !== "delivered" && order.fulfillmentStatus !== "fulfilled").length;
  const manualOrders = visibleOrders.filter((order) => !order.squareOrderId && !order.squarePaymentId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales processing"
        title="Orders command"
        description="A fast sales desk for orders, payment tracking, customer attribution, affiliate credit, reserved stock, packing, shipping, and delivery."
        icon={ClipboardList}
        kicker={`${formatNumber(visibleOrders.length)} active orders`}
        stats={[
          { label: "Today revenue", value: formatCurrency(revenueToday, 0), detail: `${formatNumber(todayOrders.length)} paid orders booked`, icon: BadgeDollarSign, tone: "green" },
          { label: "Units moved", value: formatNumber(unitsToday), detail: "Units booked from current stock", icon: PackageCheck, tone: "blue" },
          { label: "Payment queue", value: formatNumber(pendingPayments), detail: "Orders still waiting on collection", icon: ReceiptText, tone: pendingPayments > 0 ? "amber" : "green" },
          { label: "Fulfillment queue", value: formatNumber(openFulfillment), detail: "Unfulfilled, packed, or shipped orders", icon: Truck, tone: openFulfillment > 0 ? "amber" : "slate" }
        ]}
        actions={
          <>
          <Link
            href="/orders/new?returnTo=%2Forders"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Plus size={16} />
            New order
          </Link>
            <Link
              href="/analytics"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <BarChart3 size={16} />
              Order analytics
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <MetricCard featured title="Revenue today" value={formatCurrency(revenueToday)} detail={`${formatNumber(todayOrders.length)} paid orders`} icon={BadgeDollarSign} tone="green" />
        <MetricCard title="Units today" value={formatNumber(unitsToday)} detail="Units booked today" icon={PackageCheck} tone="blue" />
        <MetricCard title="All active orders" value={formatNumber(visibleOrders.length)} detail={`${formatNumber(manualOrders)} manual entries`} icon={ClipboardList} tone="slate" />
        <MetricCard title="Pending payment" value={formatNumber(pendingPayments)} detail="Orders needing collection" icon={ReceiptText} tone={pendingPayments > 0 ? "amber" : "green"} />
        <MetricCard title="Fulfillment queue" value={formatNumber(openFulfillment)} detail="Not yet delivered" icon={Truck} tone={openFulfillment > 0 ? "amber" : "green"} />
      </section>

      <OrdersWorkbench initialOrders={orders} initialProducts={products} initialInventoryBatches={inventoryBatches} />
    </div>
  );
}
