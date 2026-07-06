import { ManualOrderForm } from "@/components/manual-order-form";
import { getLocalStore } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const store = await getLocalStore();
  return <ManualOrderForm products={store.products} inventoryBatches={store.inventoryBatches} customers={store.customers} affiliates={store.affiliates} />;
}
