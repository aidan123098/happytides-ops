import { ProductCreateForm } from "@/components/product-create-form";
import { getProducts } from "@/lib/services/operational-data";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const products = await getProducts();
  const categories = [...new Set(products.map((product) => product.category))].sort();

  return <ProductCreateForm categories={categories} />;
}
