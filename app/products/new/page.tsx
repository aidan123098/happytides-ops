import { ProductCreateForm } from "@/components/product-create-form";
import { getLocalStore } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const { products } = await getLocalStore();
  const categories = [...new Set(products.map((product) => product.category))].sort();

  return <ProductCreateForm categories={categories} />;
}
