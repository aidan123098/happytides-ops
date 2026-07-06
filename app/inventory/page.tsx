import { Boxes } from "lucide-react";
import { DataTable, Td } from "@/components/data-table";
import { InventoryWorkbench } from "@/components/inventory-workbench";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocalStore } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { inventoryBatches, inventoryMovements, orders, products } = await getLocalStore();

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Inventory control</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Batch inventory</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Track quantity on hand, reserved inventory, sold units, lot numbers, expiration dates, supplier, storage, COA, and adjustment history.
          </p>
        </div>
      </section>

      <InventoryWorkbench initialBatches={inventoryBatches} products={products} orders={orders} />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Boxes size={17} className="text-blue-700" />
            <CardTitle>Inventory movement audit</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={["Time", "Product", "Batch", "Type", "Change", "Reason", "User"]}>
            {inventoryMovements.map((movement) => (
              <tr key={movement.id}>
                <Td>{movement.at}</Td>
                <Td className="font-medium text-slate-950">{movement.product}</Td>
                <Td className="font-mono text-xs">{movement.batch}</Td>
                <Td><Badge tone={movement.type === "sold" ? "blue" : movement.type === "received" ? "green" : "amber"}>{movement.type}</Badge></Td>
                <Td className={movement.delta < 0 ? "text-red-600" : "text-emerald-700"}>{movement.delta}</Td>
                <Td>{movement.reason}</Td>
                <Td>{movement.staff}</Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
