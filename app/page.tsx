import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Flame,
  MapPinned,
  PackageCheck,
  Radar,
  Repeat,
  ShoppingBag,
  Sparkles,
  Timer,
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

function daysUntil(value: string) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function latestOrders(orders: Order[]) {
  return [...orders].sort((left, right) => {
    return (parseDate(right.createdAt)?.getTime() ?? 0) - (parseDate(left.createdAt)?.getTime() ?? 0);
  });
}

function paymentMix(orders: Order[]) {
  const paid = orders.filter((order) => order.paymentStatus === "paid");
  const grouped = new Map<string, { label: string; revenueCents: number; orders: number }>();

  for (const order of paid) {
    const current = grouped.get(order.paymentMethod) ?? { label: order.paymentMethod, revenueCents: 0, orders: 0 };
    current.revenueCents += order.totalCents;
    current.orders += 1;
    grouped.set(order.paymentMethod, current);
  }

  return [...grouped.values()].sort((left, right) => right.revenueCents - left.revenueCents);
}

function inventoryHealth(batches: InventoryBatch[]) {
  const totalOnHand = batches.reduce((sum, batch) => sum + batch.quantityOnHand, 0);
  const reserved = batches.reduce((sum, batch) => sum + batch.quantityReserved, 0);
  const lowStock = batches.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold);
  const expiringSoon = batches.filter((batch) => {
    const days = daysUntil(batch.expirationDate);
    return days !== null && days >= 0 && days <= 90;
  });
  const blocked = batches.filter((batch) => ["quarantined", "damaged", "expired"].includes(batch.status));

  return { totalOnHand, reserved, lowStock, expiringSoon, blocked };
}

export default async function DashboardPage() {
  const store = await getLocalStore();
  const dashboard = getDashboardData(store);
  const { locationSales, metrics, products, revenueSeries } = dashboard;
  const orders = latestOrders(dashboard.recentOrders);
  const customers = getDerivedCustomers(store);
  const health = inventoryHealth(store.inventoryBatches);
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const mix = paymentMix(orders).slice(0, 4);
  const topCustomers = customers.filter((customer) => customer.orderCount > 0).slice(0, 5);
  const hotProducts = [...products].sort((left, right) => right.unitsSoldWeek - left.unitsSoldWeek).slice(0, 6);
  const topLocationRevenue = locationSales[0]?.revenue ? locationSales[0].revenue * 100 : 0;
  const totalLocationRevenue = locationSales.reduce((sum, location) => sum + location.revenue * 100, 0);
  const priorityItems: Array<{ label: string; detail: string; href: string; tone: PriorityTone; icon: typeof AlertTriangle }> = [
    {
      label: `${formatNumber(health.lowStock.length)} stock alerts`,
      detail: health.lowStock.length > 0 ? "Reorder or adjust count before demand catches you." : "No low-stock batches are blocking sales.",
      href: "/inventory",
      tone: health.lowStock.length > 0 ? "amber" : "green",
      icon: AlertTriangle
    },
    {
      label: `${formatNumber(health.expiringSoon.length)} expiring soon`,
      detail: "Review lots inside the next 90 days.",
      href: "/inventory",
      tone: health.expiringSoon.length > 0 ? "amber" : "green",
      icon: Timer
    },
    {
      label: `${formatNumber(metrics.orderCountToday)} orders today`,
      detail: `${formatNumber(metrics.unitsSoldToday)} units allocated from live inventory.`,
      href: "/orders",
      tone: metrics.orderCountToday > 0 ? "blue" : "slate",
      icon: ClipboardCheck
    },
    {
      label: `${formatNumber(metrics.returningCustomers)} repeat customers`,
      detail: `${formatNumber(metrics.newCustomers)} new buyers in the current customer set.`,
      href: "/customers",
      tone: metrics.returningCustomers > 0 ? "blue" : "slate",
      icon: Repeat
    }
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[#0d1117] text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="p-5 sm:p-6 lg:p-7">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="inline-flex h-7 items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 text-emerald-200">
                <Sparkles size={14} />
                Live operations
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-white/10 bg-white/[0.06] px-2.5 text-slate-300">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </span>
            </div>
            <div className="mt-6 max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">HappyTides command center</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Track cash, orders, stock risk, customer momentum, and next actions from one operating surface.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><BadgeDollarSign size={14} /> Today</div>
                <div className="mt-2 text-2xl font-semibold">{formatCurrency(metrics.revenueToday)}</div>
                <div className="mt-1 text-xs text-slate-400">{formatNumber(metrics.orderCountToday)} orders / {formatNumber(metrics.unitsSoldToday)} units</div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><TrendingUp size={14} /> Week</div>
                <div className="mt-2 text-2xl font-semibold">{formatCurrency(metrics.revenueWeek)}</div>
                <div className="mt-1 text-xs text-slate-400">{metrics.topWeek?.unitsSoldWeek ? metrics.topWeek.name : "No weekly leader yet"}</div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><Boxes size={14} /> Inventory</div>
                <div className="mt-2 text-2xl font-semibold">{formatNumber(health.totalOnHand)}</div>
                <div className="mt-1 text-xs text-slate-400">{formatNumber(health.lowStock.length)} alerts / {formatNumber(health.reserved)} reserved</div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 bg-white/[0.04] p-5 sm:p-6 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-400">Priority rail</div>
                <div className="mt-1 text-sm font-semibold text-white">What to handle first</div>
              </div>
              <Badge tone={health.lowStock.length > 0 ? "amber" : "green"}>{health.lowStock.length > 0 ? "Review" : "Clear"}</Badge>
            </div>
            <div className="mt-4 space-y-2">
              {priorityItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} href={item.href} className="group flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.06] p-3 transition-colors hover:bg-white/[0.1]">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">{item.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-400">{item.detail}</span>
                    </span>
                    <ArrowRight size={15} className="mt-2 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
        <MetricCard featured title="Revenue today" value={formatCurrency(metrics.revenueToday)} detail={`${formatNumber(metrics.orderCountToday)} completed orders`} icon={BadgeDollarSign} tone="green" />
        <MetricCard title="Orders today" value={formatNumber(metrics.orderCountToday)} detail={`${formatNumber(metrics.unitsSoldToday)} units allocated`} icon={ClipboardList} tone="blue" />
        <MetricCard title="Average order" value={formatCurrency(metrics.aov)} detail="Paid order average today" icon={ShoppingBag} tone="slate" />
        <MetricCard title="Inventory risk" value={formatNumber(health.lowStock.length)} detail={`${formatNumber(health.expiringSoon.length)} expiring soon`} icon={AlertTriangle} tone={health.lowStock.length > 0 ? "amber" : "green"} />
        <MetricCard title="Revenue month" value={formatCurrency(metrics.revenueMonth)} detail="Month-to-date booked sales" icon={Wallet} tone="green" />
        <MetricCard title="Top today" value={metrics.topToday?.unitsSoldToday ? metrics.topToday.name : "No sales yet"} detail={`${formatNumber(metrics.topToday?.unitsSoldToday ?? 0)} units sold today`} icon={PackageCheck} tone="slate" />
        <MetricCard title="Top week" value={metrics.topWeek?.unitsSoldWeek ? metrics.topWeek.name : "No sales yet"} detail={`${formatNumber(metrics.topWeek?.unitsSoldWeek ?? 0)} units in 7 days`} icon={Flame} tone="blue" />
        <MetricCard title="Repeat signal" value={`${metrics.repeatRate}%`} detail={`${formatNumber(metrics.returningCustomers)} returning / ${formatNumber(metrics.newCustomers)} new`} icon={Users} tone="blue" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
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

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Operating queue</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Fast actions for the next person on shift.</p>
            </div>
            <Radar size={18} className="text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ["Create sale", "/orders/new?returnTo=%2F", "Record an in-person order and allocate stock", "primary"],
              ["Check reorder list", "/inventory", "Review coverage, expiring lots, and manual counts", "secondary"],
              ["Follow up customers", "/customers", "Find VIP, returning, and new buyer records", "secondary"],
              ["Open analytics", "/analytics", "Inspect product, location, and demand signals", "secondary"]
            ].map(([label, href, detail, style]) => (
              <Link
                key={label}
                href={href}
                className={style === "primary"
                  ? "group flex items-center justify-between gap-3 rounded-md bg-slate-950 p-3 text-white transition-colors hover:bg-slate-800"
                  : "group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-white"}
              >
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className={style === "primary" ? "mt-1 block text-xs text-slate-300" : "mt-1 block text-xs text-slate-500"}>{detail}</span>
                </span>
                <ArrowRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Stock exposure</CardTitle>
              <p className="mt-1 text-sm text-slate-500">What can disrupt fulfillment.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["On hand", formatNumber(health.totalOnHand), "Available batch quantity", "green"],
              ["Reserved", formatNumber(health.reserved), "Committed but not sold", "blue"],
              ["Blocked", formatNumber(health.blocked.length), "Quarantine, damage, or expired", "amber"],
              ["Expiring", formatNumber(health.expiringSoon.length), "Lots inside 90 days", "amber"]
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
              <p className="mt-1 text-sm text-slate-500">Weekly product movement and revenue concentration.</p>
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
                  <div className="mt-2 text-xs text-slate-500">{formatCurrency(product.revenueWeekCents)} week revenue</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue mix</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Payments and locations driving cash.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {mix.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No paid payment mix yet.</div> : null}
              {mix.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                    <div className="text-xs text-slate-500">{formatNumber(item.orders)} orders</div>
                  </div>
                  <div className="text-sm font-semibold text-slate-950">{formatCurrency(item.revenueCents)}</div>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <MapPinned size={15} />
                Top location
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{locationSales[0]?.name ?? "No sales yet"}</div>
              <div className="mt-1 text-xs text-slate-500">
                {topLocationRevenue > 0 ? `${formatCurrency(topLocationRevenue)} of ${formatCurrency(totalLocationRevenue)}` : "Location performance appears after paid orders."}
              </div>
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
          <CardContent>
            <DataTable columns={["Order", "Customer", "Items", "Payment", "Location", "Total"]}>
              {orders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <Td className="font-medium text-slate-950">{order.orderNumber}</Td>
                  <Td>{order.customerName}</Td>
                  <Td>{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}</Td>
                  <Td><Badge tone={order.paymentStatus === "paid" ? "green" : "amber"}>{order.paymentMethod}</Badge></Td>
                  <Td>{order.location}</Td>
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

      <section className="grid gap-4 xl:grid-cols-3">
        {[
          { title: "Fulfillment stance", detail: health.lowStock.length > 0 ? "Inventory needs active attention before the next rush." : "Stock coverage looks workable from current thresholds.", icon: Truck, tone: health.lowStock.length > 0 ? "amber" : "green", href: "/inventory" },
          { title: "Sales stance", detail: metrics.orderCountToday > 0 ? "Orders are flowing and totals are updating across the system." : "Start with a manual order when the first sale comes in.", icon: ShoppingBag, tone: metrics.orderCountToday > 0 ? "green" : "slate", href: "/orders/new?returnTo=%2F" },
          { title: "Data confidence", detail: "Dashboard numbers are derived from paid orders, live catalog, and inventory batches.", icon: CheckCircle2, tone: "blue", href: "/analytics" }
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
