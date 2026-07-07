import Link from "next/link";
import { BadgeDollarSign, ClipboardList, PackageCheck, Plus, ReceiptText, Truck } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { OrdersWorkbench } from "@/components/orders-workbench";
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
  const unfulfilled = visibleOrders.filter((order) => order.fulfillmentStatus !== "fulfilled").length;
  const manualOrders = visibleOrders.filter((order) => !order.squareOrderId && !order.squarePaymentId).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Sales processing</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Orders</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Process in-person orders, record payment method, and keep inventory accurate.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/orders/new?returnTo=%2Forders"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Plus size={16} />
            New order
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <MetricCard featured title="Revenue today" value={formatCurrency(revenueToday)} detail={`${formatNumber(todayOrders.length)} paid orders`} icon={BadgeDollarSign} tone="green" />
        <MetricCard title="Units today" value={formatNumber(unitsToday)} detail="Inventory allocated today" icon={PackageCheck} tone="blue" />
        <MetricCard title="All active orders" value={formatNumber(visibleOrders.length)} detail={`${formatNumber(manualOrders)} manual entries`} icon={ClipboardList} tone="slate" />
        <MetricCard title="Pending payment" value={formatNumber(pendingPayments)} detail="Orders needing collection" icon={ReceiptText} tone={pendingPayments > 0 ? "amber" : "green"} />
        <MetricCard title="Fulfillment holds" value={formatNumber(unfulfilled)} detail="Orders not marked fulfilled" icon={Truck} tone={unfulfilled > 0 ? "amber" : "green"} />
      </section>

      <OrdersWorkbench initialOrders={orders} initialProducts={products} initialInventoryBatches={inventoryBatches} />
    </div>
  );
}
