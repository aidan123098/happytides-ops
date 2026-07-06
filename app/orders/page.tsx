import Link from "next/link";
import { Plus } from "lucide-react";
import { OrdersWorkbench } from "@/components/orders-workbench";
import { getLocalStore } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { inventoryBatches, orders, products } = await getLocalStore();

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Sales processing</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Orders</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Process in-person orders, record payment method, and keep inventory accurate.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/orders/new?returnTo=%2Forders"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Plus size={16} />
            New order
          </Link>
        </div>
      </section>

      <OrdersWorkbench initialOrders={orders} initialProducts={products} initialInventoryBatches={inventoryBatches} />
    </div>
  );
}
