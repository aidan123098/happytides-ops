import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
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
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsSummaryFromStore } from "@/lib/live-metrics";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SignalTone = "blue" | "green" | "amber" | "slate";

function productSignal(product: { unitsSoldWeek: number }) {
  if (product.unitsSoldWeek >= 10) return { label: "Reorder watch", tone: "amber" as const };
  if (product.unitsSoldWeek > 0) return { label: "Moving", tone: "blue" as const };
  return { label: "No movement", tone: "slate" as const };
}

export default async function AnalyticsPage() {
  const summary = getAnalyticsSummaryFromStore(await getLocalStore());
  const productsToWatch = summary.products
    .filter((product) => product.unitsSoldWeek > 0 || product.revenueWeekCents > 0)
    .sort((left, right) => right.unitsSoldWeek - left.unitsSoldWeek || right.revenueWeekCents - left.revenueWeekCents)
    .slice(0, 8);
  const followUps = summary.topCustomers.filter((customer) => customer.orderCount > 0).slice(0, 8);
  const urgentProducts = productsToWatch.filter((product) => product.unitsSoldWeek >= 10);
  const operatingSignals: Array<{ label: string; value: string; detail: string; href: string; tone: SignalTone; icon: LucideIcon }> = [
    {
      label: "Reorder pressure",
      value: formatNumber(summary.lowStock.length),
      detail: summary.lowStock.length > 0 ? "Low-stock counts need action" : "No low-stock alerts from thresholds",
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
  ];

  const exceptions: Array<{ label: string; value: number; href: string; icon: LucideIcon }> = [
    { label: "Low-stock counts", value: summary.lowStock.length, href: "/inventory", icon: AlertTriangle },
    { label: "Dormant customers", value: summary.dormantCustomers.length, href: "/customers", icon: Users },
    { label: "Open products", value: summary.products.filter((product) => product.active).length, href: "/products", icon: Boxes }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analytics"
        title="Analytics"
        description="A practical readout for sales momentum, product velocity, customer follow-up, fulfillment pressure, and inventory risk."
        icon={TrendingUp}
        kicker={`${formatNumber(summary.ordersWeek)} paid orders this week`}
        stats={[
          { label: "Today", value: formatCurrency(summary.revenueTodayCents, 0), detail: `${formatNumber(summary.ordersToday)} orders / ${formatNumber(summary.unitsToday)} units`, icon: ShoppingBag, tone: "green" },
          { label: "Week", value: formatCurrency(summary.revenueWeekCents, 0), detail: `${formatNumber(summary.unitsWeek)} units sold in 7 days`, icon: TrendingUp, tone: "blue" },
          { label: "Inventory risk", value: formatNumber(summary.lowStock.length), detail: "Low-stock counts needing review", icon: AlertTriangle, tone: summary.lowStock.length > 0 ? "amber" : "green" },
          { label: "Follow-up", value: formatNumber(followUps.length), detail: "Customers with purchase history", icon: Users, tone: followUps.length > 0 ? "blue" : "slate" }
        ]}
        actions={
          <>
            <Link
              href="/orders/new?returnTo=%2Fanalytics"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <ClipboardList size={16} />
              New order
            </Link>
            <Link
              href="/inventory"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Boxes size={16} />
              Inventory risk
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard featured title="Revenue today" value={formatCurrency(summary.revenueTodayCents)} detail={`${formatNumber(summary.ordersToday)} orders / ${formatNumber(summary.unitsToday)} units`} icon={TrendingUp} tone="green" />
        <MetricCard title="Revenue week" value={formatCurrency(summary.revenueWeekCents)} detail={`${formatNumber(summary.ordersWeek)} paid orders in 7 days`} icon={ShoppingBag} tone="blue" />
        <MetricCard title="Units week" value={formatNumber(summary.unitsWeek)} detail={summary.topWeek?.unitsSoldWeek ? `${summary.topWeek.name} leads demand` : "No product movement yet"} icon={PackageCheck} tone="slate" />
        <MetricCard title="Inventory risk" value={formatNumber(summary.lowStock.length)} detail="Low-stock counts needing review" icon={AlertTriangle} tone={summary.lowStock.length > 0 ? "amber" : "green"} />
        <MetricCard title="Average order" value={formatCurrency(summary.aovTodayCents)} detail="Today across paid orders" icon={ClipboardList} tone="slate" />
        <MetricCard title="Open products" value={formatNumber(summary.products.filter((product) => product.active).length)} detail="Active catalog items" icon={Boxes} tone="blue" />
        <MetricCard title="Active customers" value={formatNumber(summary.activeCustomers)} detail={`${formatNumber(summary.repeatPurchaseRate)}% repeat purchase signal`} icon={Repeat} tone="blue" />
        <MetricCard title="Turnaround time" value={summary.averageDaysBetweenPurchases ? `${summary.averageDaysBetweenPurchases}d` : "N/A"} detail="Average time between paid orders" icon={Timer} tone="slate" />
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
          <CardContent className="space-y-3">
            <div className="space-y-3 lg:hidden">
              {productsToWatch.map((product) => {
                const signal = productSignal(product);

                return (
                  <div key={product.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-950">{product.name}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">{product.sku}</div>
                      </div>
                      <Badge tone={signal.tone}>{signal.label}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-slate-50 p-2">
                        <div className="text-xs text-slate-500">Units week</div>
                        <div className="font-semibold text-slate-950">{formatNumber(product.unitsSoldWeek)}</div>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <div className="text-xs text-slate-500">Revenue week</div>
                        <div className="font-semibold text-slate-950">{formatCurrency(product.revenueWeekCents)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <DataTable className="hidden lg:block" columns={["Product", "Units week", "Revenue week", "Signal"]}>
              {productsToWatch.map((product) => {
                const signal = productSignal(product);

                return (
                  <tr key={product.id}>
                    <Td className="font-medium text-slate-950">{product.name}</Td>
                    <Td>{formatNumber(product.unitsSoldWeek)}</Td>
                    <Td>{formatCurrency(product.revenueWeekCents)}</Td>
                    <Td><Badge tone={signal.tone}>{signal.label}</Badge></Td>
                  </tr>
                );
              })}
            </DataTable>
            {productsToWatch.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No product sales yet.</div> : null}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Customer follow-up</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Best customers to recognize, retain, or re-engage.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3 lg:hidden">
              {followUps.map((customer) => (
                <div key={customer.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950">{customer.firstName} {customer.lastName}</div>
                      <div className="mt-1 truncate text-sm text-slate-500">{customer.favoriteProduct}</div>
                    </div>
                    <Badge tone={customer.orderCount > 1 ? "blue" : "green"}>{customer.orderCount > 1 ? "Repeat" : "New"}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Spend</div>
                      <div className="font-semibold text-slate-950">{formatCurrency(customer.totalSpendCents)}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Orders</div>
                      <div className="font-semibold text-slate-950">{formatNumber(customer.orderCount)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DataTable className="hidden lg:block" columns={["Customer", "Spend", "Orders", "Favorite", "Signal"]}>
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
          <CardContent className="space-y-3">
            <div className="space-y-3 lg:hidden">
              {summary.recentOrders.map((order) => (
                <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950">{order.orderNumber}</div>
                      <div className="mt-1 truncate text-sm text-slate-500">{order.customerName}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-950">{formatCurrency(order.totalCents)}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Items</div>
                      <div className="font-semibold text-slate-950">{formatNumber(order.items.reduce((sum, item) => sum + item.quantity, 0))}</div>
                    </div>
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

            <DataTable className="hidden lg:block" columns={["Order", "Customer", "Items", "Total"]}>
              {summary.recentOrders.map((order) => (
                <tr key={order.id}>
                  <Td className="font-medium text-slate-950">{order.orderNumber}</Td>
                  <Td>{order.customerName}</Td>
                  <Td>{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}</Td>
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
