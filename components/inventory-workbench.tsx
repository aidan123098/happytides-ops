"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import type { InventoryBatch, Order, Product } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { formatCurrency, formatNumberOrNA } from "@/lib/utils";

type InventoryWorkbenchProps = {
  initialBatches: InventoryBatch[];
  products: Product[];
  orders: Order[];
};

const reorderTargetDays = 45;
const reorderWatchDays = 30;
const reorderUrgentDays = 14;
const inventoryStatuses: InventoryBatch["status"][] = ["available", "reserved", "sold", "quarantined", "damaged"];
type ReorderSignal = "Need sales data" | "Order now" | "Watch" | "Healthy";

type ReceiveBatchForm = {
  productId: string;
  quantityOnHand: string;
  reorderThreshold: string;
  batchNumber: string;
  lotNumber: string;
  expirationDate: string;
  supplier: string;
  costPerVial: string;
  storageRequirements: string;
  coaDocumentUrl: string;
  status: InventoryBatch["status"];
  reason: string;
};

function dollarsToCents(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function batchTone(batch: InventoryBatch) {
  if (batch.status === "available") {
    return batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold ? "amber" : "green";
  }

  return batch.status === "quarantined" || batch.status === "damaged" ? "amber" : "slate";
}

function signalTone(signal: ReorderSignal) {
  if (signal === "Order now") return "amber";
  if (signal === "Watch") return "blue";
  if (signal === "Healthy") return "green";
  return "slate";
}

export function InventoryWorkbench({ initialBatches, products, orders }: InventoryWorkbenchProps) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [liveOrders, setLiveOrders] = useState(orders);
  const [receiveForm, setReceiveForm] = useState<ReceiveBatchForm>({
    productId: products[0]?.id ?? "",
    quantityOnHand: "0",
    reorderThreshold: "10",
    batchNumber: "",
    lotNumber: "",
    expirationDate: "2099-12-31",
    supplier: "",
    costPerVial: "",
    storageRequirements: "Refrigerated",
    coaDocumentUrl: "",
    status: "available",
    reason: "Initial receipt"
  });
  const [receiving, setReceiving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [adjustBatchId, setAdjustBatchId] = useState(initialBatches[0]?.id ?? "");
  const [adjustDelta, setAdjustDelta] = useState("0");
  const [adjustStatus, setAdjustStatus] = useState<InventoryBatch["status"]>(initialBatches[0]?.status ?? "available");
  const [adjustReason, setAdjustReason] = useState("");
  const [showReceive, setShowReceive] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useLiveRefresh({
    onRefresh: async () => {
      const [inventoryResponse, ordersResponse] = await Promise.all([
        fetch("/api/inventory", { cache: "no-store" }),
        fetch("/api/orders", { cache: "no-store" })
      ]);

      if (inventoryResponse.ok) {
        const payload = await inventoryResponse.json().catch(() => null);
        if (Array.isArray(payload?.batches)) setBatches(payload.batches);
      }

      if (ordersResponse.ok) {
        const payload = await ordersResponse.json().catch(() => null);
        if (Array.isArray(payload?.orders)) setLiveOrders(payload.orders);
      }

      router.refresh();
    }
  });

  const selectedBatch = batches.find((batch) => batch.id === adjustBatchId);
  const suppliers = [...new Set(batches.map((batch) => batch.supplier))];
  const receiveReady = receiveForm.productId && receiveForm.batchNumber.trim() && receiveForm.lotNumber.trim() && receiveForm.supplier.trim() && receiveForm.storageRequirements.trim() && receiveForm.costPerVial.trim() && Number.parseInt(receiveForm.quantityOnHand, 10) >= 0 && dollarsToCents(receiveForm.costPerVial) >= 0 && receiveForm.reason.trim().length >= 4;
  const filteredBatches = batches.filter((batch) => {
    const product = products.find((item) => item.id === batch.productId);
    const matchesSearch = [batch.productName, product?.sku, batch.batchNumber, batch.lotNumber, batch.supplier].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || batch.status === status;
    const matchesSupplier = supplier === "all" || batch.supplier === supplier;
    return matchesSearch && matchesStatus && matchesSupplier;
  });
  const reorderRows = useMemo(() => {
    const now = Date.now();
    const windowDays = 30;
    const windowStart = now - windowDays * 24 * 60 * 60 * 1000;
    const paidOrders = liveOrders.filter((order) => {
      const createdAt = new Date(order.createdAt).getTime();
      return order.orderNumber !== "N/A" && order.paymentStatus === "paid" && Number.isFinite(createdAt) && createdAt >= windowStart;
    });

    return batches
      .map((batch) => {
        const product = products.find((item) => item.id === batch.productId);
        const soldLastWindow = paidOrders.reduce((sum, order) => {
          return sum + order.items.reduce((itemSum, item) => {
            const matchesBatch = item.inventoryBatchId ? item.inventoryBatchId === batch.id : item.productId === batch.productId || item.productName === batch.productName;
            return itemSum + (matchesBatch ? item.quantity : 0);
          }, 0);
        }, 0);
        const dailyVelocity = soldLastWindow / windowDays;
        const available = Math.max(batch.quantityOnHand - batch.quantityReserved, 0);
        const daysRemaining = dailyVelocity > 0 ? Math.floor(available / dailyVelocity) : null;
        const targetStock = Math.ceil(dailyVelocity * reorderTargetDays);
        const suggestedReorder = dailyVelocity > 0 ? Math.max(targetStock - available, 0) : 0;
        const signal: ReorderSignal = daysRemaining === null ? "Need sales data" : daysRemaining <= reorderUrgentDays ? "Order now" : daysRemaining <= reorderWatchDays ? "Watch" : "Healthy";

        return {
          batch,
          sku: product?.sku ?? "N/A",
          available,
          soldLastWindow,
          dailyVelocity,
          daysRemaining,
          suggestedReorder,
          signal
        };
      })
      .sort((left, right) => (left.daysRemaining ?? 9999) - (right.daysRemaining ?? 9999));
  }, [batches, liveOrders, products]);

  async function applyAdjustment() {
    const quantityDelta = Number.parseInt(adjustDelta, 10);

    if (!adjustBatchId || !Number.isFinite(quantityDelta) || !adjustReason.trim()) {
      setMessage("Choose a product, enter a stock change, and add a reason.");
      return;
    }

    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: adjustBatchId, quantityDelta, reason: adjustReason, status: adjustStatus })
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Adjustment could not be saved.");
      return;
    }

    setBatches((current) => current.map((batch) => (batch.id === payload.batch.id ? payload.batch : batch)));
    setAdjustDelta("0");
    setAdjustStatus(payload.batch.status);
    setAdjustReason("");
    setMessage(`${payload.batch.productName} adjusted. New on-hand count: ${payload.batch.quantityOnHand}. Status: ${payload.batch.status}.`);
    router.refresh();
  }

  async function receiveBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!receiveReady) {
      setMessage("Complete product, stock ID, supplier, quantity, cost, storage, and reason before receiving stock.");
      return;
    }

    const quantityOnHand = Number.parseInt(receiveForm.quantityOnHand, 10);
    const reorderThreshold = Number.parseInt(receiveForm.reorderThreshold, 10);
    setReceiving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: receiveForm.productId,
          quantityOnHand,
          reorderThreshold: Number.isFinite(reorderThreshold) ? reorderThreshold : 10,
          batchNumber: receiveForm.batchNumber,
          lotNumber: receiveForm.lotNumber,
          expirationDate: receiveForm.expirationDate,
          supplier: receiveForm.supplier,
          costPerVialCents: dollarsToCents(receiveForm.costPerVial),
          storageRequirements: receiveForm.storageRequirements,
          coaDocumentUrl: receiveForm.coaDocumentUrl || undefined,
          status: receiveForm.status,
          reason: receiveForm.reason
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Stock could not be received.");
      }

      setBatches((current) => [payload.batch, ...current]);
      setAdjustBatchId(payload.batch.id);
      setAdjustStatus(payload.batch.status);
      setReceiveForm((current) => ({
        ...current,
        quantityOnHand: "0",
        batchNumber: "",
        lotNumber: "",
        expirationDate: "2099-12-31",
        supplier: "",
        costPerVial: "",
        coaDocumentUrl: "",
        reason: "Initial receipt"
      }));
      setMessage(`${payload.batch.productName} stock received with ${payload.batch.quantityOnHand} units.`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Stock could not be received.");
    } finally {
      setReceiving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Receive stock</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Collapsed by default. Open only when adding new stock.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setShowReceive((open) => !open)}>
            {showReceive ? "Close" : "Open"}
          </Button>
        </CardHeader>
        {showReceive ? <CardContent>
          <form onSubmit={receiveBatch} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="xl:col-span-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Product</span>
              <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={receiveForm.productId} onChange={(event) => setReceiveForm({ ...receiveForm, productId: event.target.value })}>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} / {product.strengthLabel}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Stock ID</span>
              <Input className="mt-1 bg-white" value={receiveForm.batchNumber} onChange={(event) => setReceiveForm({ ...receiveForm, batchNumber: event.target.value })} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Internal code</span>
              <Input className="mt-1 bg-white" value={receiveForm.lotNumber} onChange={(event) => setReceiveForm({ ...receiveForm, lotNumber: event.target.value })} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Quantity</span>
              <Input className="mt-1 bg-white" min={0} type="number" value={receiveForm.quantityOnHand} onChange={(event) => setReceiveForm({ ...receiveForm, quantityOnHand: event.target.value })} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Reorder</span>
              <Input className="mt-1 bg-white" min={0} type="number" value={receiveForm.reorderThreshold} onChange={(event) => setReceiveForm({ ...receiveForm, reorderThreshold: event.target.value })} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Cost</span>
              <Input className="mt-1 bg-white" inputMode="decimal" value={receiveForm.costPerVial} onChange={(event) => setReceiveForm({ ...receiveForm, costPerVial: event.target.value })} placeholder="25.00" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
              <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={receiveForm.status} onChange={(event) => setReceiveForm({ ...receiveForm, status: event.target.value as InventoryBatch["status"] })}>
                {inventoryStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Supplier</span>
              <Input className="mt-1 bg-white" value={receiveForm.supplier} onChange={(event) => setReceiveForm({ ...receiveForm, supplier: event.target.value })} />
            </label>
            <label className="xl:col-span-2">
              <span className="text-xs font-semibold uppercase text-slate-500">COA URL</span>
              <Input className="mt-1 bg-white" value={receiveForm.coaDocumentUrl} onChange={(event) => setReceiveForm({ ...receiveForm, coaDocumentUrl: event.target.value })} placeholder="https://..." />
            </label>
            <label className="xl:col-span-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Storage</span>
              <Input className="mt-1 bg-white" value={receiveForm.storageRequirements} onChange={(event) => setReceiveForm({ ...receiveForm, storageRequirements: event.target.value })} />
            </label>
            <label className="xl:col-span-3">
              <span className="text-xs font-semibold uppercase text-slate-500">Reason</span>
              <Input className="mt-1 bg-white" value={receiveForm.reason} onChange={(event) => setReceiveForm({ ...receiveForm, reason: event.target.value })} />
            </label>
            <div className="flex items-end xl:col-span-3">
              <Button type="submit" disabled={receiving || !receiveReady}>
                <PackagePlus size={16} />
                {receiving ? "Receiving" : "Receive stock"}
              </Button>
            </div>
          </form>
        </CardContent> : null}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Manual inventory adjustment</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Collapsed by default. Open for cycle counts, corrections, and status changes.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setShowAdjust((open) => !open)}>
            {showAdjust ? "Close" : "Open"}
          </Button>
        </CardHeader>
        {showAdjust ? <CardContent className="space-y-3">
          {selectedBatch ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Selected stock</div>
                <div className="mt-1 font-mono text-slate-950">{selectedBatch.batchNumber} / {selectedBatch.lotNumber}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Available</div>
                <div className="mt-1 font-semibold text-slate-950">{Math.max(selectedBatch.quantityOnHand - selectedBatch.quantityReserved, 0)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Storage</div>
                <div className="mt-1 text-slate-700">{selectedBatch.storageRequirements}</div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_120px_160px_minmax(180px,1fr)_auto] md:items-end">
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Product</span>
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30"
              value={adjustBatchId}
              onChange={(event) => {
                const nextBatch = batches.find((batch) => batch.id === event.target.value);
                setAdjustBatchId(event.target.value);
                setAdjustStatus(nextBatch?.status ?? "available");
              }}
            >
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.productName} - {batch.batchNumber}/{batch.lotNumber}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Change</span>
            <Input className="mt-1" type="number" value={adjustDelta} onChange={(event) => setAdjustDelta(event.target.value)} placeholder="+5 or -2" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={adjustStatus} onChange={(event) => setAdjustStatus(event.target.value as InventoryBatch["status"])}>
              {inventoryStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Reason</span>
            <Input className="mt-1" value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} placeholder="Cycle count, damage, received stock" />
          </label>
          <Button onClick={applyAdjustment}>Save change</Button>
          {message ? <div className="text-sm text-slate-600 md:col-span-5">{message}</div> : null}
          </div>
        </CardContent> : null}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Inventory stock</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Search and filter stock by SKU, product, supplier, and status.</p>
          </div>
          <Badge tone="amber">{batches.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold).length} warnings</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 md:grid-cols-[minmax(180px,1fr)_180px_180px]">
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Search</span>
              <Input className="mt-1 bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU, product, stock, supplier" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
              <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All status</option>
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="quarantined">Quarantined</option>
                <option value="damaged">Damaged</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Supplier</span>
              <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={supplier} onChange={(event) => setSupplier(event.target.value)}>
                <option value="all">All suppliers</option>
                {suppliers.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredBatches.map((batch) => {
              const product = products.find((item) => item.id === batch.productId);
              const available = Math.max(batch.quantityOnHand - batch.quantityReserved, 0);
              const lowStock = batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold;

              return (
                <div key={batch.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950">{batch.productName}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{product?.sku ?? "N/A"} / {batch.batchNumber}</div>
                    </div>
                    <Badge tone={batchTone(batch)}>{lowStock ? "Low stock" : batch.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">On hand</div>
                      <div className="font-semibold text-slate-950">{formatNumberOrNA(batch.quantityOnHand)}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Available</div>
                      <div className="font-semibold text-slate-950">{formatNumberOrNA(available)}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Reserved</div>
                      <div className="font-semibold text-slate-950">{formatNumberOrNA(batch.quantityReserved)}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Sold</div>
                      <div className="font-semibold text-slate-950">{formatNumberOrNA(batch.quantitySold)}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Reorder point</div>
                      <div className="font-semibold text-slate-950">{formatNumberOrNA(batch.reorderThreshold)}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Unit cost</div>
                      <div className="font-semibold text-slate-950">{formatCurrency(batch.costPerVialCents)}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Supplier</span>
                      <span className="text-right font-medium text-slate-950">{batch.supplier}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Storage</span>
                      <span className="text-right font-medium text-slate-950">{batch.storageRequirements}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DataTable className="hidden lg:block" columns={["Product", "Stock ID", "On hand", "Reserved", "Sold", "Reorder", "Supplier", "Cost", "Status"]}>
            {filteredBatches.map((batch) => {
              const lowStock = batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold;
              return (
                <tr key={batch.id}>
                  <Td className="font-medium text-slate-950">{batch.productName}</Td>
                  <Td><div className="font-mono text-xs">{batch.batchNumber}</div><div className="font-mono text-xs text-slate-500">{batch.lotNumber}</div></Td>
                  <Td><Badge tone={lowStock ? "amber" : "green"}>{batch.quantityOnHand}</Badge></Td>
                  <Td>{batch.quantityReserved}</Td>
                  <Td>{batch.quantitySold}</Td>
                  <Td>{batch.reorderThreshold ?? "N/A"}</Td>
                  <Td>{batch.supplier}</Td>
                  <Td>{formatCurrency(batch.costPerVialCents)}</Td>
                  <Td><Badge tone={batchTone(batch)}>{batch.status}</Badge></Td>
                </tr>
              );
            })}
          </DataTable>
          {filteredBatches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No inventory stock matches the current filters.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Reorder calculator</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Uses paid-order velocity from the last 30 days to estimate stock coverage and suggested reorder quantities.</p>
          </div>
          <Badge tone="blue">{reorderTargetDays} day target</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Watch point</div>
              <div className="mt-1 text-xl font-semibold text-slate-950">{reorderWatchDays} days</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Urgent point</div>
              <div className="mt-1 text-xl font-semibold text-slate-950">{reorderUrgentDays} days</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Order now</div>
              <div className="mt-1 text-xl font-semibold text-slate-950">{formatNumberOrNA(reorderRows.filter((row) => row.signal === "Order now").length)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Need data</div>
              <div className="mt-1 text-xl font-semibold text-slate-950">{formatNumberOrNA(reorderRows.filter((row) => row.signal === "Need sales data").length)}</div>
            </div>
          </div>
          <div className="space-y-3 lg:hidden">
            {reorderRows.map((row) => (
              <div key={row.batch.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{row.batch.productName}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{row.sku}</div>
                  </div>
                  <Badge tone={signalTone(row.signal)}>{row.signal}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">Available</div>
                    <div className="font-semibold text-slate-950">{formatNumberOrNA(row.available)}</div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">Sold 30d</div>
                    <div className="font-semibold text-slate-950">{formatNumberOrNA(row.soldLastWindow)}</div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">Daily velocity</div>
                    <div className="font-semibold text-slate-950">{row.dailyVelocity > 0 ? row.dailyVelocity.toFixed(2) : "N/A"}</div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">Days left</div>
                    <div className="font-semibold text-slate-950">{row.daysRemaining === null ? "N/A" : `${row.daysRemaining} days`}</div>
                  </div>
                </div>
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
                  <div className="text-xs text-slate-500">Suggested order</div>
                  <div className="font-semibold text-slate-950">{row.suggestedReorder > 0 ? `${formatNumberOrNA(row.suggestedReorder)} units` : "No reorder suggested"}</div>
                </div>
              </div>
            ))}
          </div>

          <DataTable className="hidden lg:block" columns={["Product", "SKU", "Available", "Sold 30d", "Daily velocity", "Days left", "Suggested order", "Signal"]}>
            {reorderRows.map((row) => (
              <tr key={row.batch.id}>
                <Td className="font-medium text-slate-950">{row.batch.productName}</Td>
                <Td className="font-mono text-xs">{row.sku}</Td>
                <Td>{row.available}</Td>
                <Td>{formatNumberOrNA(row.soldLastWindow)}</Td>
                <Td>{row.dailyVelocity > 0 ? row.dailyVelocity.toFixed(2) : "N/A"}</Td>
                <Td>{row.daysRemaining === null ? "N/A" : `${row.daysRemaining} days`}</Td>
                <Td className="font-medium text-slate-950">{row.suggestedReorder > 0 ? row.suggestedReorder : "N/A"}</Td>
                <Td>
                  <Badge tone={signalTone(row.signal)}>{row.signal}</Badge>
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
