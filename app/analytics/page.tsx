import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  MapPin,
  PackageCheck,
  Repeat,
  ShoppingBag,
  Timer,
  TrendingUp,
  Users,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProductMixChart, RevenueChart } from "@/components/charts";
import { DataTable, Td } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsSummaryFromStore } from "@/lib/live-metrics";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function maxRevenue(revenue: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.round((revenue / total) * 100), 100);
}

type SignalTone = "blue" | "green" | "amber" | "slate";

export default async function AnalyticsPage() {
  const summary = getAnalyticsSummaryFromStore(await getLocalStore());
  const productsToWatch = summary.products
    .filter((product) => product.unitsSoldWeek > 0 || product.revenueWeekCents > 0)
    .sort((left, right) => right.unitsSoldWeek - left.unitsSoldWeek || right.revenueWeekCents - left.revenueWeekCents)
    .slice(0, 8);
  const followUps = summary.topCustomers.filter((customer) => customer.orderCount > 0).slice(0, 8);
  const totalLocationRevenue = summary.locationSales.reduce((sum, location) => sum + location.revenue * 100, 0);
  const urgentProducts = productsToWatch.filter((product) => product.unitsSoldWeek >= 10);
  const operatingSignals: Array<{ label: string; value: string; detail: string; href: string; tone: SignalTone; icon: LucideIcon }> = [
    {
      label: "Reorder pressure",
      value: formatNumber(summary.lowStock.length),
      detail: summary.lowStock.length > 0 ? "Low-stock batches need action" : "No low-stock alerts from thresholds",
      href: "/inventory",
      tone: summary.lowStock.length > 0 ? "amber" : "green",
      icon: AlertTriangle
    },
    {
      label: "Hot SKUs",
      value: formatNumber(urgentProducts.length),
      detail: "Products selling fast enough to watch closely",
      href: "/products",
      tone: urgentProducts.length > 0 ? "blue" : "slate",
      icon: Zap
    },
    {
      label: "Customer follow-up",
      value: formatNumber(followUps.length),
      detail: "Customers with purchase history to recognize",
      href: "/customers",
      tone: followUps.length > 0 ? "blue" : "slate",
      icon: Users
    },
    {
      label: "Lot review",
      value: formatNumber(summary.expiringSoon.length),
      detail: "Batches expiring inside the operating window",
      href: "/inventory",
      tone: summary.expiringSoon.length > 0 ? "amber" : "green",
      icon: Timer
    }
  ];

  const exceptions: Array<{ label: string; value: number; href: string; icon: LucideIcon }> = [
    { label: "Low-stock batches", value: summary.lowStock.length, href: "/inventory", icon: AlertTriangle },
    { label: "Expiring soon", value: summary.expiringSoon.length, href: "/inventory", icon: Timer },
    { label: "Dormant customers", value: summary.dormantCustomers.length, href: "/customers", icon: Users },
    { label: "Open products", value: summary.products.filter((product) => product.active).length, href: "/products", icon: Boxes }
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white/85 p-5 shadow-panel sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-700">Analytics</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Operating intelligence</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              A practical readout for sales momentum, product velocity, customer follow-up, location performance, and fulfillment risk.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">Today</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{formatCurrency(summary.revenueTodayCents, 0)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">Week</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{formatCurrency(summary.revenueWeekCents, 0)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">Month</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{formatCurrency(summary.revenueMonthCents, 0)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard featured title="Revenue today" value={formatCurrency(summary.revenueTodayCents)} detail={`${formatNumber(summary.ordersToday)} orders / ${formatNumber(summary.unitsToday)} units`} icon={TrendingUp} tone="green" />
        <MetricCard title="Revenue week" value={formatCurrency(summary.revenueWeekCents)} detail={`${formatNumber(summary.ordersWeek)} paid orders in 7 days`} icon={ShoppingBag} tone="blue" />
        <MetricCard title="Units week" value={formatNumber(summary.unitsWeek)} detail={summary.topWeek?.unitsSoldWeek ? `${summary.topWeek.name} leads demand` : "No product movement yet"} icon={PackageCheck} tone="slate" />
        <MetricCard title="Inventory risk" value={formatNumber(summary.lowStock.length)} detail="Low-stock batches needing review" icon={AlertTriangle} tone={summary.lowStock.length > 0 ? "amber" : "green"} />
        <MetricCard title="Average order" value={formatCurrency(summary.aovTodayCents)} detail="Today across paid orders" icon={ClipboardList} tone="slate" />
        <MetricCard title="Locations" value={formatNumber(summary.locationSales.length)} detail="Places or events producing sales" icon={MapPin} tone="blue" />
        <MetricCard title="Active customers" value={formatNumber(summary.activeCustomers)} detail={`${formatNumber(summary.repeatPurchaseRate)}% repeat purchase signal`} icon={Repeat} tone="blue" />
        <MetricCard title="Purchase rhythm" value={summary.averageDaysBetweenPurchases ? `${summary.averageDaysBetweenPurchases}d` : "N/A"} detail="Average time between paid orders" icon={Timer} tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales trend</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Daily revenue with order and unit movement.</p>
            </div>
            <Badge tone="blue">7 days</Badge>
          </CardHeader>
          <CardContent>
            <RevenueChart data={summary.revenueSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Decision board</CardTitle>
              <p className="mt-1 text-sm text-slate-500">The shortest path from numbers to action.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {operatingSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <Link key={signal.label} href={signal.href} className="group flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-white">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-700">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">{signal.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{signal.detail}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={signal.tone}>{signal.value}</Badge>
                    <ArrowRight size={14} className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Product mix</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Weekly demand concentration by catalog item.</p>
            </div>
          </CardHeader>
          <CardContent>
            <ProductMixChart products={summary.products} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Products to watch</CardTitle>
              <p className="mt-1 text-sm text-slate-500">SKU velocity and reorder attention from paid orders.</p>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={["Product", "Units week", "Revenue week", "Signal"]}>
              {productsToWatch.map((product) => (
                <tr key={product.id}>
                  <Td className="font-medium text-slate-950">{product.name}</Td>
                  <Td>{formatNumber(product.unitsSoldWeek)}</Td>
                  <Td>{formatCurrency(product.revenueWeekCents)}</Td>
                  <Td><Badge tone={product.unitsSoldWeek >= 10 ? "amber" : product.unitsSoldWeek > 0 ? "blue" : "slate"}>{product.unitsSoldWeek >= 10 ? "Reorder watch" : product.unitsSoldWeek > 0 ? "Moving" : "No movement"}</Badge></Td>
                </tr>
              ))}
            </DataTable>
            {productsToWatch.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No product sales yet.</div> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales by location</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Where money is coming from right now.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.locationSales.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No paid orders have location data yet.</div>
            ) : null}
            {summary.locationSales.map((location) => {
              const revenueCents = location.revenue * 100;
              return (
                <div key={location.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-800">{location.name}</span>
                    <span className="text-slate-500">{formatCurrency(revenueCents)} / {formatNumber(location.orders)} orders</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-slate-950" style={{ width: `${maxRevenue(revenueCents, totalLocationRevenue)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Customer follow-up</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Best customers to recognize, retain, or re-engage.</p>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={["Customer", "Spend", "Orders", "Favorite", "Signal"]}>
              {followUps.map((customer) => (
                <tr key={customer.id}>
                  <Td className="font-medium text-slate-950">{customer.firstName} {customer.lastName}</Td>
                  <Td>{formatCurrency(customer.totalSpendCents)}</Td>
                  <Td>{formatNumber(customer.orderCount)}</Td>
                  <Td>{customer.favoriteProduct}</Td>
                  <Td><Badge tone={customer.orderCount > 1 ? "blue" : "green"}>{customer.orderCount > 1 ? "Repeat" : "New"}</Badge></Td>
                </tr>
              ))}
            </DataTable>
            {followUps.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No customer purchase history yet.</div> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent order activity</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Newest paid orders that should already reflect in revenue and inventory.</p>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={["Order", "Customer", "Items", "Location", "Total"]}>
              {summary.recentOrders.map((order) => (
                <tr key={order.id}>
                  <Td className="font-medium text-slate-950">{order.orderNumber}</Td>
                  <Td>{order.customerName}</Td>
                  <Td>{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}</Td>
                  <Td>{order.location}</Td>
                  <Td className="font-medium text-slate-950">{formatCurrency(order.totalCents)}</Td>
                </tr>
              ))}
            </DataTable>
            {summary.recentOrders.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No paid orders recorded yet.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Operational exceptions</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Things that can interrupt sales or fulfillment.</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {exceptions.map(({ label, value, href, icon: Icon }) => (
              <Link key={label} href={href} className="group flex items-center justify-between gap-3 rounded-md border bg-slate-50 p-4 transition-colors hover:bg-white">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-slate-700">
                    <Icon size={17} />
                  </span>
                  <span className="text-sm font-medium text-slate-950">{label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-slate-950">{formatNumber(value)}</span>
                  <ArrowRight size={14} className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
