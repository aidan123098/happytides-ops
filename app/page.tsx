import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeDollarSign, Boxes, ClipboardList, PackageCheck, Repeat, ShoppingBag, Sparkles, Users } from "lucide-react";
import { ProductMixChart, RevenueChart } from "@/components/charts";
import { DataTable, Td } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/live-metrics";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PriorityTone = "blue" | "green" | "amber" | "slate";

export default async function DashboardPage() {
  const dashboard = getDashboardData(await getLocalStore());
  const { locationSales, metrics, products, recentOrders, revenueSeries } = dashboard;
  const priorityItems: Array<{ label: string; detail: string; tone: PriorityTone }> = [
    { label: `${formatNumber(metrics.lowStock.length)} low-stock products`, detail: "Review reorder coverage", tone: metrics.lowStock.length > 0 ? "amber" : "green" },
    { label: `${formatNumber(recentOrders.length)} recent orders`, detail: "Latest operational activity", tone: recentOrders.length > 0 ? "blue" : "slate" },
    { label: `${formatCurrency(metrics.revenueWeek)} booked this week`, detail: "Paid order revenue", tone: metrics.revenueWeek > 0 ? "green" : "slate" },
    { label: `${formatNumber(metrics.returningCustomers)} returning customers`, detail: "Repeat purchase signal", tone: metrics.returningCustomers > 0 ? "blue" : "slate" }
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-950 p-5 text-white shadow-panel sm:p-6">
        <p className="text-sm font-semibold text-emerald-300">Operations command center</p>
        <div className="mt-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">HappyTides Ops</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              A live operating view for sales, inventory risk, customer activity, and order throughput.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
            <div className="text-xs font-semibold text-slate-400">Week-to-date net sales</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight">{formatCurrency(metrics.revenueWeek)}</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
              <Sparkles size={14} className="text-emerald-300" />
              {formatNumber(metrics.unitsSoldToday)} units today / {formatCurrency(metrics.aov)} AOV
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
          <MetricCard featured title="Revenue today" value={formatCurrency(metrics.revenueToday)} detail={`${formatNumber(metrics.orderCountToday)} completed orders`} icon={BadgeDollarSign} tone="green" />
          <MetricCard title="Orders today" value={formatNumber(metrics.orderCountToday)} detail={`${formatNumber(metrics.unitsSoldToday)} units allocated`} icon={ClipboardList} tone="blue" />
          <MetricCard title="Average order" value={formatCurrency(metrics.aov)} detail="Paid order average today" icon={ShoppingBag} tone="slate" />
          <MetricCard title="Inventory risk" value={formatNumber(metrics.lowStock.length)} detail="Low-stock batches to review" icon={AlertTriangle} tone={metrics.lowStock.length > 0 ? "amber" : "green"} />
          <MetricCard title="Revenue month" value={formatCurrency(metrics.revenueMonth)} detail="Month-to-date booked sales" icon={BadgeDollarSign} tone="green" />
          <MetricCard title="Top today" value={metrics.topToday?.unitsSoldToday ? metrics.topToday.name : "No sales yet"} detail={`${formatNumber(metrics.topToday?.unitsSoldToday ?? 0)} units sold today`} icon={PackageCheck} tone="slate" />
          <MetricCard title="Top week" value={metrics.topWeek?.unitsSoldWeek ? metrics.topWeek.name : "No sales yet"} detail={`${formatNumber(metrics.topWeek?.unitsSoldWeek ?? 0)} units in 7 days`} icon={Boxes} tone="blue" />
          <MetricCard title="Repeat signal" value={`${metrics.repeatRate}%`} detail={`${formatNumber(metrics.returningCustomers)} returning / ${formatNumber(metrics.newCustomers)} new`} icon={Repeat} tone="blue" />
        </div>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Priority feed</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Operational signals that need attention first.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {priorityItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.detail}</div>
                </div>
                <Badge tone={item.tone}>{item.tone === "green" ? "Clear" : "Review"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue trend</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Daily revenue, order count, and unit velocity.</p>
            </div>
            <Badge tone="blue">Day view</Badge>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Product velocity</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Weekly demand by active catalog item.</p>
            </div>
          </CardHeader>
          <CardContent>
            <ProductMixChart products={products} />
            <div className="space-y-2">
              {[...products].sort((a, b) => b.unitsSoldWeek - a.unitsSoldWeek).slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: product.colorAccent }} />
                    <span className="truncate text-slate-700">{product.name}</span>
                  </div>
                  <span className="font-medium text-slate-950">{formatNumber(product.unitsSoldWeek)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-amber-600" />
              <CardTitle>Inventory risk</CardTitle>
            </div>
            <Badge tone={metrics.lowStock.length > 0 ? "amber" : "green"}>{metrics.lowStock.length} low stock</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.lowStock.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No low-stock products need attention right now.</div>
            ) : null}
            {metrics.lowStock.map((batch) => (
              <div key={batch.id} className="rounded-md border bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-950">{batch.productName}</div>
                    <div className="text-xs text-slate-500">{batch.batchNumber} / {batch.lotNumber}</div>
                  </div>
                  <Badge tone="amber">{formatNumber(batch.quantityOnHand)} left</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent orders</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Latest paid or manually entered sales.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users size={14} />
              Customer-safe records
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={["Order", "Customer", "Items", "Payment", "Total"]}>
              {recentOrders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <Td className="font-medium text-slate-950">{order.orderNumber}</Td>
                  <Td>{order.customerName}</Td>
                  <Td>{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}</Td>
                  <Td><Badge tone={order.paymentStatus === "paid" ? "green" : "amber"}>{order.paymentMethod}</Badge></Td>
                  <Td className="font-medium text-slate-950">{formatCurrency(order.totalCents)}</Td>
                </tr>
              ))}
            </DataTable>
            {recentOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No orders recorded yet.</div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales by location/event</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Event and studio sales mix.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {locationSales.map((location) => (
              <div key={location.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{location.name}</span>
                  <span className="text-slate-500">{formatCurrency(location.revenue * 100)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-slate-950" style={{ width: `${location.orders > 0 ? Math.min(location.orders * 14, 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Next best actions</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Quick paths for daily operators.</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {[
              ["Create an order", "/orders/new?returnTo=%2F", "Record sale and allocate inventory"],
              ["Review inventory", "/inventory", "Check stock, movement, and reorder risk"],
              ["Open products", "/products", "Review catalog, pricing, and margins"],
              ["View analytics", "/analytics", "Inspect revenue and operations signals"]
            ].map(([label, href, detail]) => (
              <Link key={label} href={href} className="group rounded-md border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-slate-300 hover:bg-white">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-950">
                  {label}
                  <ArrowRight size={14} className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-1 text-xs text-slate-500">{detail}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
