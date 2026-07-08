import { ManualOrderForm } from "@/components/manual-order-form";
import { getAffiliates, getCustomers, getInventoryBatches, getProducts } from "@/lib/services/operational-data";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [products, inventoryBatches, customers, affiliates] = await Promise.all([getProducts(), getInventoryBatches(), getCustomers(), getAffiliates()]);
  const activeProducts = products.filter((product) => product.active);
  const availableBatches = inventoryBatches.filter((batch) => batch.status === "available" && batch.quantityOnHand > batch.quantityReserved);

  return <ManualOrderForm products={activeProducts} inventoryBatches={availableBatches} customers={customers} affiliates={affiliates} />;
}
