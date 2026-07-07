import { BadgeCheck, Boxes, CircleDollarSign, FileWarning, PackageCheck } from "lucide-react";
import { ProductsWorkbench } from "@/components/products-workbench";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { products } = await getLocalStore();
  const activeProducts = products.filter((product) => product.active);
  const weeklyRevenueCents = products.reduce((sum, product) => sum + product.revenueWeekCents, 0);
  const weeklyUnits = products.reduce((sum, product) => sum + product.unitsSoldWeek, 0);
  const missingCoas = products.filter((product) => product.coaUrl === "N/A" || !product.coaUrl).length;
  const averageMargin = activeProducts.reduce((sum, product) => sum + product.marginPercent, 0) / Math.max(activeProducts.length, 1);
  const topMovers = [...products].sort((left, right) => right.unitsSoldWeek - left.unitsSoldWeek).slice(0, 4);
  const attentionProducts = [...products]
    .filter((product) => product.active && (product.marginPercent < 45 || product.coaUrl === "N/A" || !product.coaUrl || product.unitsSoldWeek === 0))
    .sort((left, right) => left.marginPercent - right.marginPercent || left.unitsSoldWeek - right.unitsSoldWeek)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Catalog</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Products</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage premium research-use product details, pricing, margins, COAs, disclaimers, imagery, and active selling status.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Active SKUs" value={formatNumber(activeProducts.length)} detail={`${formatNumber(products.length)} total catalog records`} icon={PackageCheck} tone="green" />
        <MetricCard title="Week Revenue" value={formatCurrency(weeklyRevenueCents)} detail={`${formatNumber(weeklyUnits)} units sold this week`} icon={CircleDollarSign} tone="blue" featured />
        <MetricCard title="Average Margin" value={formatPercent(averageMargin)} detail="Active catalog average" icon={BadgeCheck} tone={averageMargin >= 60 ? "green" : "amber"} />
        <MetricCard title="COA Gaps" value={formatNumber(missingCoas)} detail="Records missing a linked COA" icon={FileWarning} tone={missingCoas > 0 ? "amber" : "green"} />
        <MetricCard title="Inactive SKUs" value={formatNumber(products.length - activeProducts.length)} detail="Hidden from normal selling flow" icon={Boxes} tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Catalog momentum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topMovers.map((product, index) => (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-sm font-semibold text-slate-700 shadow-sm">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{product.name}</div>
                    <div className="text-xs text-slate-500">{product.sku} / {product.strengthLabel}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-950">{formatNumber(product.unitsSoldWeek)} units</div>
                  <div className="text-xs text-slate-500">{formatCurrency(product.revenueWeekCents)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catalog attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attentionProducts.length > 0 ? attentionProducts.map((product) => (
              <div key={product.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{product.name}</div>
                    <div className="text-xs text-slate-500">{product.sku}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{formatPercent(product.marginPercent)} margin</div>
                    <div>{product.coaUrl === "N/A" || !product.coaUrl ? "COA missing" : `${formatNumber(product.unitsSoldWeek)} week units`}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                Active catalog records have clean COA links, healthy margins, and recent movement.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <ProductsWorkbench products={products} />

      <Card>
        <CardHeader>
          <CardTitle>Research-use disclaimer template</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-slate-50 p-4 text-sm text-slate-600">
            For research use only. Not for human or veterinary use. Product language in HappyTides Ops stays neutral and operational.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
