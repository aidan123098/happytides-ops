import { ProductsWorkbench } from "@/components/products-workbench";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocalStore } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { products } = await getLocalStore();

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
