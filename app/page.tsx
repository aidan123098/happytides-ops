import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  ClipboardList,
  Flame,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Wallet
} from "lucide-react";
import { ProductMixChart, RevenueChart } from "@/components/charts";
import { DataTable, Td } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData, getDerivedCustomers } from "@/lib/live-metrics";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { InventoryBatch, Order } from "@/types/domain";

export const dynamic = "force-dynamic";

type PriorityTone = "blue" | "green" | "amber" | "slate";

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestOrders(orders: Order[]) {
  return [...orders].sort((left, right) => {
    return (parseDate(right.createdAt)?.getTime() ?? 0) - (parseDate(left.createdAt)?.getTime() ?? 0);
  });
}

function inventoryHealth(batches: InventoryBatch[]) {
  const totalOnHand = batches.reduce((sum, batch) => sum + batch.quantityOnHand, 0);
  const reserved = batches.reduce((sum, batch) => sum + batch.quantityReserved, 0);
  const lowStock = batches.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold);

  return { totalOnHand, reserved, lowStock };
}

export default async function DashboardPage() {
  const store = await getLocalStore();
  const dashboard = getDashboardData(store);
  const { metrics, products, revenueSeries } = dashboard;
  const orders = latestOrders(dashboard.recentOrders);
  const customers = getDerivedCustomers(store);
  const health = inventoryHealth(store.inventoryBatches);
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const topCustomers = customers.filter((customer) => customer.orderCount > 0).slice(0, 5);
  const hotProducts = [...products].sort((left, right) => right.unitsSoldWeek - left.unitsSoldWeek).slice(0, 6);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[#0d1117] text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:items-center lg:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="inline-flex h-7 items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 text-emerald-200">
                <Sparkles size={14} />
                Live operations
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-white/10 bg-white/[0.06] px-2.5 text-slate-300">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </span>
            </div>
            <div className="mt-4 max-w-3xl">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">HappyTides command center</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Track sales, order flow, stock risk, and customer momentum from one operating surface.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-400"><BadgeDollarSign size={13} /> Today</div>
              <div className="mt-2 text-xl font-semibold sm:text-2xl">{formatCurrency(metrics.revenueToday, 0)}</div>
              <div className="mt-1 text-[11px] leading-4 text-slate-400">{formatNumber(metrics.orderCountToday)} orders</div>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-400"><TrendingUp size={13} /> Week</div>
              <div className="mt-2 text-xl font-semibold sm:text-2xl">{formatCurrency(metrics.revenueWeek, 0)}</div>
              <div className="mt-1 truncate text-[11px] leading-4 text-slate-400">{metrics.topWeek?.unitsSoldWeek ? metrics.topWeek.name : "No leader"}</div>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-400"><Boxes size={13} /> Stock</div>
              <div className="mt-2 text-xl font-semibold sm:text-2xl">{formatNumber(health.totalOnHand)}</div>
              <div className="mt-1 text-[11px] leading-4 text-slate-400">{formatNumber(health.reserved)} reserved</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
        <MetricCard featured title="Revenue today" value={formatCurrency(metrics.revenueToday)} detail={`${formatNumber(metrics.orderCountToday)} completed orders`} icon={BadgeDollarSign} tone="green" />
        <MetricCard title="Orders today" value={formatNumber(metrics.orderCountToday)} detail={`${formatNumber(metrics.unitsSoldToday)} units allocated`} icon={ClipboardList} tone="blue" />
        <MetricCard title="Average order" value={formatCurrency(metrics.aov)} detail="Paid order average today" icon={ShoppingBag} tone="slate" />
        <MetricCard title="Inventory risk" value={formatNumber(health.lowStock.length)} detail={`${formatNumber(health.reserved)} units reserved`} icon={AlertTriangle} tone={health.lowStock.length > 0 ? "amber" : "green"} />
        <MetricCard title="Revenue month" value={formatCurrency(metrics.revenueMonth)} detail="Month-to-date booked sales" icon={Wallet} tone="green" />
        <MetricCard title="Top today" value={metrics.topToday?.unitsSoldToday ? metrics.topToday.name : "No sales yet"} detail={`${formatNumber(metrics.topToday?.unitsSoldToday ?? 0)} units sold today`} icon={PackageCheck} tone="slate" />
        <MetricCard title="Top week" value={metrics.topWeek?.unitsSoldWeek ? metrics.topWeek.name : "No sales yet"} detail={`${formatNumber(metrics.topWeek?.unitsSoldWeek ?? 0)} units in 7 days`} icon={Flame} tone="blue" />
        <MetricCard title="Repeat signal" value={`${metrics.repeatRate}%`} detail={`${formatNumber(metrics.returningCustomers)} returning / ${formatNumber(metrics.newCustomers)} new`} icon={Users} tone="blue" />
      </section>

      <section>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales flight path</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Revenue, order count, and unit movement over the last seven days.</p>
            </div>
            <Badge tone="blue">Live trend</Badge>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueSeries} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Stock exposure</CardTitle>
              <p className="mt-1 text-sm text-slate-500">What can disrupt fulfillment.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["On hand", formatNumber(health.totalOnHand), "Available stock quantity", "green"],
              ["Reserved", formatNumber(health.reserved), "Committed but not sold", "blue"]
            ].map(([label, value, detail, tone]) => (
              <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{label}</div>
                    <div className="mt-1 text-xs text-slate-500">{detail}</div>
                  </div>
                  <Badge tone={tone as PriorityTone}>{value}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Product velocity</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Product movement over the last seven days.</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <ProductMixChart products={products} />
            <div className="space-y-2">
              {hotProducts.map((product) => (
                <div key={product.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: product.colorAccent }} />
                      <span className="truncate font-semibold text-slate-950">{product.name}</span>
                    </div>
                    <span className="font-semibold text-slate-950">{formatNumber(product.unitsSoldWeek)}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white">
                    <div className="h-1.5 rounded-full bg-slate-950" style={{ width: `${Math.min(product.unitsSoldWeek * 10, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Newest order activity</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Latest paid or manually entered sales, with inventory already reflected.</p>
            </div>
            <Badge tone="slate">{formatNumber(paidOrders.length)} paid orders</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3 lg:hidden">
              {orders.slice(0, 8).map((order) => (
                <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950">{order.orderNumber}</div>
                      <div className="mt-1 truncate text-sm text-slate-500">{order.customerName}</div>
                    </div>
                    <Badge tone={order.paymentStatus === "paid" ? "green" : "amber"}>{order.paymentMethod}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Total</div>
                      <div className="font-semibold text-slate-950">{formatCurrency(order.totalCents)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    {order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}
                  </div>
                </div>
              ))}
            </div>

            <DataTable className="hidden lg:block" columns={["Order", "Customer", "Items", "Payment", "Total"]}>
              {orders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <Td className="font-medium text-slate-950">{order.orderNumber}</Td>
                  <Td>{order.customerName}</Td>
                  <Td>{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}</Td>
                  <Td><Badge tone={order.paymentStatus === "paid" ? "green" : "amber"}>{order.paymentMethod}</Badge></Td>
                  <Td className="font-medium text-slate-950">{formatCurrency(order.totalCents)}</Td>
                </tr>
              ))}
            </DataTable>
            {orders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No orders recorded yet.</div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Customer radar</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Best customers to recognize, retain, or re-engage.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {topCustomers.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Customer momentum appears after orders are recorded.</div> : null}
            {topCustomers.map((customer) => (
              <div key={customer.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{customer.firstName} {customer.lastName}</div>
                    <div className="mt-1 text-xs text-slate-500">{customer.favoriteProduct}</div>
                  </div>
                  <Badge tone={customer.orderCount > 1 ? "blue" : "green"}>{customer.status}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{formatNumber(customer.orderCount)} orders</span>
                  <span className="font-semibold text-slate-950">{formatCurrency(customer.totalSpendCents)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {[
          { title: "Fulfillment stance", detail: health.lowStock.length > 0 ? "Inventory needs active attention before the next rush." : "Stock coverage looks workable from current thresholds.", icon: Truck, tone: health.lowStock.length > 0 ? "amber" : "green", href: "/inventory" },
          { title: "Sales stance", detail: metrics.orderCountToday > 0 ? "Orders are flowing and totals are updating across the system." : "Start with a manual order when the first sale comes in.", icon: ShoppingBag, tone: metrics.orderCountToday > 0 ? "green" : "slate", href: "/orders/new?returnTo=%2F" }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} href={item.href} className="group rounded-lg border border-slate-200 bg-white/80 p-4 shadow-panel transition-colors hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Icon size={17} />
                </span>
                <Badge tone={item.tone as PriorityTone}>Open</Badge>
              </div>
              <div className="mt-4 text-sm font-semibold text-slate-950">{item.title}</div>
              <div className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</div>
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition-colors group-hover:text-slate-950">
                Review workflow
                <ArrowRight size={14} />
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
