import { AlertTriangle, Boxes, ClipboardList, MapPin, PackageCheck, Repeat, ShoppingBag, TrendingUp } from "lucide-react";
import { RevenueChart } from "@/components/charts";
import { DataTable, Td } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsSummaryFromStore } from "@/lib/live-metrics";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const summary = getAnalyticsSummaryFromStore(await getLocalStore());
  const productsToWatch = summary.products
    .filter((product) => product.unitsSoldWeek > 0)
    .sort((left, right) => right.unitsSoldWeek - left.unitsSoldWeek)
    .slice(0, 8);
  const followUps = summary.topCustomers.filter((customer) => customer.orderCount > 0).slice(0, 8);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium text-blue-700">Analytics</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">Business intelligence</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Operator-focused signals for today&apos;s sales, product velocity, customer follow-up, and inventory risk.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard featured title="Revenue today" value={formatCurrency(summary.revenueTodayCents)} detail={`${formatNumber(summary.ordersToday)} orders / ${formatNumber(summary.unitsToday)} units`} icon={TrendingUp} tone="green" />
        <MetricCard title="Revenue week" value={formatCurrency(summary.revenueWeekCents)} detail={`${formatNumber(summary.ordersWeek)} paid orders in 7 days`} icon={ShoppingBag} tone="blue" />
        <MetricCard title="Units week" value={formatNumber(summary.unitsWeek)} detail={summary.topWeek?.unitsSoldWeek ? `${summary.topWeek.name} leads demand` : "No product movement yet"} icon={PackageCheck} tone="slate" />
        <MetricCard title="Inventory risk" value={formatNumber(summary.lowStock.length)} detail="Low-stock batches needing review" icon={AlertTriangle} tone={summary.lowStock.length > 0 ? "amber" : "green"} />
        <MetricCard title="Average order" value={formatCurrency(summary.aovTodayCents)} detail="Today across paid orders" icon={ClipboardList} tone="slate" />
        <MetricCard title="Revenue month" value={formatCurrency(summary.revenueMonthCents)} detail="Month-to-date booked sales" icon={Boxes} tone="green" />
        <MetricCard title="Active customers" value={formatNumber(summary.activeCustomers)} detail={`${formatNumber(summary.repeatPurchaseRate)}% repeat purchase signal`} icon={Repeat} tone="blue" />
        <MetricCard title="Locations" value={formatNumber(summary.locationSales.length)} detail="Places or events producing sales" icon={MapPin} tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales trend</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Daily revenue with order and unit movement.</p>
            </div>
          </CardHeader>
          <CardContent>
            <RevenueChart data={summary.revenueSeries} />
          </CardContent>
        </Card>

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
            {summary.locationSales.map((location) => (
              <div key={location.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{location.name}</span>
                  <span className="text-slate-500">{formatCurrency(location.revenue * 100)} / {formatNumber(location.orders)} orders</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-slate-950" style={{ width: `${Math.min(location.orders * 18, 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
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
                  <Td><Badge tone={product.unitsSoldWeek >= 10 ? "amber" : "green"}>{product.unitsSoldWeek >= 10 ? "Reorder watch" : "Normal"}</Badge></Td>
                </tr>
              ))}
            </DataTable>
            {productsToWatch.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No product sales yet.</div> : null}
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
            <div className="rounded-md border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-950">Low-stock batches</div>
              <div className="mt-2 text-2xl font-semibold">{formatNumber(summary.lowStock.length)}</div>
            </div>
            <div className="rounded-md border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-950">Expiring soon</div>
              <div className="mt-2 text-2xl font-semibold">{formatNumber(summary.expiringSoon.length)}</div>
            </div>
            <div className="rounded-md border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-950">Dormant customers</div>
              <div className="mt-2 text-2xl font-semibold">{formatNumber(summary.dormantCustomers.length)}</div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
