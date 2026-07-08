import Link from "next/link";
import { BadgeCheck, Boxes, FileWarning, PackageCheck, PencilRuler, Plus } from "lucide-react";
import { ProductsWorkbench } from "@/components/products-workbench";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProducts } from "@/lib/services/operational-data";
import { formatNumber, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await getProducts();
  const activeProducts = products.filter((product) => product.active);
  const missingCoas = products.filter((product) => product.coaUrl === "N/A" || !product.coaUrl).length;
  const averageMargin = activeProducts.reduce((sum, product) => sum + product.marginPercent, 0) / Math.max(activeProducts.length, 1);
  const topMovers = [...products].sort((left, right) => right.unitsSoldWeek - left.unitsSoldWeek).slice(0, 4);
  const attentionProducts = [...products]
    .filter((product) => product.active && (product.marginPercent < 45 || product.coaUrl === "N/A" || !product.coaUrl || product.unitsSoldWeek === 0))
    .sort((left, right) => left.marginPercent - right.marginPercent || left.unitsSoldWeek - right.unitsSoldWeek)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage SKUs, pricing, COAs, margins, and catalog status."
        icon={PackageCheck}
        kicker={`${formatNumber(products.length)} catalog records`}
        stats={[
          { label: "Active SKUs", value: formatNumber(activeProducts.length), detail: "Visible in normal selling flows", icon: PackageCheck, tone: "green" },
          { label: "Tracked SKUs", value: formatNumber(products.filter((product) => product.inventoryTrackingEnabled).length), detail: "Catalog items tied to stock counts", icon: Boxes, tone: "blue" },
          { label: "COA gaps", value: formatNumber(missingCoas), detail: "Records missing linked documents", icon: FileWarning, tone: missingCoas > 0 ? "amber" : "green" },
          { label: "Avg margin", value: formatPercent(averageMargin), detail: "Active catalog average margin", icon: BadgeCheck, tone: averageMargin >= 60 ? "green" : "amber" }
        ]}
        actions={
          <>
            <Link
              href="#products-workbench"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <PencilRuler size={16} />
              Manage catalog
            </Link>
            <Link
              href="/products/new"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Plus size={16} />
              Add SKU
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Active SKUs" value={formatNumber(activeProducts.length)} detail={`${formatNumber(products.length)} total catalog records`} icon={PackageCheck} tone="green" />
        <MetricCard title="Tracked SKUs" value={formatNumber(products.filter((product) => product.inventoryTrackingEnabled).length)} detail="Connected to inventory counts" icon={Boxes} tone="blue" featured />
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

      <div id="products-workbench">
        <ProductsWorkbench products={products} />
      </div>

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
