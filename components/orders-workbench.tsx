"use client";

import { Fragment, useMemo, useState } from "react";
import { Edit3, Filter, Save, Trash2, X } from "lucide-react";
import type { InventoryBatch, Order, PaymentRecipient, Product } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { productOptionLabel } from "@/lib/product-labels";
import { paymentRecipientLabels, paymentRecipients } from "@/lib/payment-recipients";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { formatCurrency, formatCurrencyOrNA, formatNumber, formatNumberOrNA } from "@/lib/utils";

type OrdersWorkbenchProps = {
  initialOrders: Order[];
  initialProducts: Product[];
  initialInventoryBatches: InventoryBatch[];
};

type EditableLine = {
  id: string;
  productId: string;
  inventoryBatchId: string;
  quantity: number;
  unitPrice: string;
};

const paymentMethods = ["Processor", "Zelle", "Venmo", "ACH", "Crypto", "Cash", "Other"] as const;
const orderStatuses: Order["status"][] = ["unfulfilled", "paid", "packed", "shipped", "delivered"];

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function dateInputValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusSelectClasses: Record<Order["status"], string> = {
  unfulfilled: "border-rose-200 bg-rose-50 text-rose-800",
  paid: "border-blue-200 bg-blue-50 text-blue-800",
  packed: "border-amber-200 bg-amber-50 text-amber-800",
  shipped: "border-cyan-200 bg-cyan-50 text-cyan-800",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-800"
};

function makeLine(): EditableLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    inventoryBatchId: "",
    quantity: 1,
    unitPrice: ""
  };
}

function visibleOrders(orders: Order[]) {
  return orders
    .filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || right.id.localeCompare(left.id));
}

export function OrdersWorkbench({ initialOrders, initialProducts, initialInventoryBatches }: OrdersWorkbenchProps) {
  const [orders, setOrders] = useState<Order[]>(visibleOrders(initialOrders));
  const [inventoryBatches, setInventoryBatches] = useState(initialInventoryBatches);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<EditableLine[]>([]);
  const [editPaymentMethod, setEditPaymentMethod] = useState<(typeof paymentMethods)[number]>("Zelle");
  const [editPaidTo, setEditPaidTo] = useState<PaymentRecipient | "">("");
  const [editStatus, setEditStatus] = useState<Order["status"]>("unfulfilled");
  const [editCreatedAt, setEditCreatedAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [removingOrderIds, setRemovingOrderIds] = useState<string[]>([]);
  const [updatingStatusIds, setUpdatingStatusIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ tone: "green" | "amber" | "red"; text: string } | null>(null);

  useLiveRefresh({
    onRefresh: async () => {
      const [ordersResponse, inventoryResponse] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/inventory", { cache: "no-store" })
      ]);

      if (ordersResponse.ok) {
        const payload = await ordersResponse.json().catch(() => null);
        if (Array.isArray(payload?.orders)) setOrders(visibleOrders(payload.orders));
      }

      if (inventoryResponse.ok) {
        const payload = await inventoryResponse.json().catch(() => null);
        if (Array.isArray(payload?.batches)) setInventoryBatches(payload.batches);
      }
    }
  });

  const batchesByProductId = useMemo(() => {
    const grouped = new Map<string, InventoryBatch[]>();

    for (const batch of inventoryBatches) {
      const current = grouped.get(batch.productId) ?? [];
      current.push(batch);
      grouped.set(batch.productId, current);
    }

    for (const batches of grouped.values()) {
      batches.sort((left, right) => left.expirationDate.localeCompare(right.expirationDate) || left.batchNumber.localeCompare(right.batchNumber));
    }

    return grouped;
  }, [inventoryBatches]);
  const batchesById = useMemo(() => new Map(inventoryBatches.map((batch) => [batch.id, batch])), [inventoryBatches]);
  const productsById = useMemo(() => new Map(initialProducts.map((product) => [product.id, product])), [initialProducts]);
  const editingOrder = useMemo(() => orders.find((order) => order.id === editingOrderId), [editingOrderId, orders]);
  const originalQuantityByBatch = useMemo(() => {
    const restored = new Map<string, number>();

    if (!editingOrder || editingOrder.status === "unfulfilled") return restored;
    for (const item of editingOrder.items) {
      if (!item.inventoryBatchId) continue;
      restored.set(item.inventoryBatchId, (restored.get(item.inventoryBatchId) ?? 0) + item.quantity);
    }

    return restored;
  }, [editingOrder]);
  const editQuantityByBatch = useMemo(() => {
    const quantityByBatch = new Map<string, number>();

    for (const line of editLines) {
      if (!line.inventoryBatchId) continue;
      quantityByBatch.set(line.inventoryBatchId, (quantityByBatch.get(line.inventoryBatchId) ?? 0) + line.quantity);
    }

    return quantityByBatch;
  }, [editLines]);
  const allocationIssues = useMemo(() => {
    const issues: string[] = [];

    for (const [batchId, quantity] of editQuantityByBatch.entries()) {
      const batch = batchesById.get(batchId);

      if (!batch) {
        issues.push("Selected inventory batch was not found.");
        continue;
      }

      const available = batch.quantityOnHand + (originalQuantityByBatch.get(batchId) ?? 0) - batch.quantityReserved;

      if (batch.status !== "available") {
        issues.push(`${batch.productName} batch ${batch.batchNumber} is ${batch.status}.`);
      }

      if (available < quantity) {
        issues.push(`${batch.productName} batch ${batch.batchNumber} only has ${Math.max(available, 0)} units available.`);
      }
    }

    return issues;
  }, [batchesById, editQuantityByBatch, originalQuantityByBatch]);
  const canSaveEdit = allocationIssues.length === 0;

  const filteredOrders = orders.filter((order) => {
    const haystack = [
      order.orderNumber,
      order.customerName,
      order.paymentMethod,
      order.paymentStatus,
      order.fulfillmentStatus,
      order.status,
      order.notes,
      order.createdAt,
      ...order.items.map((item) => item.productName)
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesProduct = productFilter === "all" || order.items.some((item) => item.productId === productFilter || item.productName === productsById.get(productFilter)?.name);
    const matchesPayment = paymentFilter === "all" || order.paymentMethod === paymentFilter;
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesProduct && matchesPayment && matchesStatus;
  });

  function hydrateLine(order: Order): EditableLine[] {
    return order.items.map((item) => {
      const product = item.productId ? productsById.get(item.productId) : initialProducts.find((candidate) => candidate.name === item.productName);
      const batch = item.inventoryBatchId ? inventoryBatches.find((candidate) => candidate.id === item.inventoryBatchId) : product ? batchesByProductId.get(product.id)?.[0] : undefined;

      return {
        id: crypto.randomUUID(),
        productId: product?.id ?? "",
        inventoryBatchId: batch?.id ?? "",
        quantity: Math.max(item.quantity, 1),
        unitPrice: centsToDollars(item.unitPriceCents)
      };
    });
  }

  function startEdit(order: Order) {
    setMessage(null);
    setEditingOrderId(order.id);
    setEditLines(hydrateLine(order));
    setEditPaymentMethod(paymentMethods.includes(order.paymentMethod as (typeof paymentMethods)[number]) ? (order.paymentMethod as (typeof paymentMethods)[number]) : "Other");
    setEditPaidTo(order.paidTo ?? "");
    setEditStatus(order.status);
    setEditCreatedAt(dateInputValue(order.createdAt));
    setEditNotes(order.notes ?? "");
  }

  function updateEditLine(id: string, patch: Partial<EditableLine>) {
    setEditLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };

        if (patch.productId !== undefined) {
          const product = productsById.get(patch.productId);
          const batch = product ? batchesByProductId.get(product.id)?.[0] : undefined;
          next.inventoryBatchId = batch?.id ?? "";
          next.unitPrice = product ? centsToDollars(product.priceCents) : "";
        }

        return next;
      })
    );
  }

  async function saveEdit(orderId: string) {
    if (savingOrderId === orderId || removingOrderIds.includes(orderId)) return;

    const invalidLine = editLines.find((line) => !line.productId || !line.inventoryBatchId || line.quantity < 1 || dollarsToCents(line.unitPrice) <= 0);

    if (invalidLine) {
      setMessage({ tone: "red", text: "Choose a SKU, quantity, and unit price before saving the order." });
      return;
    }

    if (!canSaveEdit) {
      setMessage({ tone: "red", text: allocationIssues[0] ?? "Fix inventory allocation before saving." });
      return;
    }

    setSavingOrderId(orderId);
    setMessage({ tone: "amber", text: "Saving order changes..." });

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          customerId: orders.find((order) => order.id === orderId)?.customerId ?? "cust_placeholder",
          affiliateId: orders.find((order) => order.id === orderId)?.affiliateId,
          paymentMethod: editPaymentMethod,
          paidTo: editPaidTo || undefined,
          status: editStatus,
          createdAt: editCreatedAt,
          items: editLines.map((line) => ({
            productId: line.productId,
            inventoryBatchId: line.inventoryBatchId,
            quantity: line.quantity,
            unitPriceCents: dollarsToCents(line.unitPrice),
            discountCents: 0
          })),
          notes: editNotes
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({ tone: "red", text: payload.error ?? "Order could not be updated." });
        return;
      }

      setOrders((current) => visibleOrders(current.map((order) => (order.id === orderId ? payload.order : order))));
      if (Array.isArray(payload.batches) && payload.batches.length > 0) {
        const changed = new Map<string, InventoryBatch>(payload.batches.map((batch: InventoryBatch) => [batch.id, batch]));
        setInventoryBatches((current) => current.map((batch) => changed.get(batch.id) ?? batch));
      }
      setEditingOrderId(null);
      setMessage({ tone: "green", text: `${payload.order.orderNumber} updated and inventory rebalanced.` });
    } catch {
      setMessage({ tone: "red", text: "Order could not be updated. Check the local dev server and try again." });
    } finally {
      setSavingOrderId(null);
    }
  }

  async function changeStatus(order: Order, status: Order["status"]) {
    if (status === order.status || updatingStatusIds.includes(order.id)) return;
    setUpdatingStatusIds((current) => [...current, order.id]);
    setOrders((current) => current.map((candidate) => candidate.id === order.id ? { ...candidate, status } : candidate));
    setMessage({ tone: "amber", text: `Updating ${order.orderNumber} to ${status}...` });

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.order) {
        setOrders((current) => current.map((candidate) => candidate.id === order.id ? order : candidate));
        setMessage({ tone: "red", text: payload.error ?? "Order status could not be updated." });
        return;
      }

      setOrders((current) => visibleOrders(current.map((candidate) => (candidate.id === order.id ? { ...candidate, ...payload.order } : candidate))));
      if (Array.isArray(payload.batches) && payload.batches.length > 0) {
        const changed = new Map<string, InventoryBatch>(payload.batches.map((batch: InventoryBatch) => [batch.id, batch]));
        setInventoryBatches((current) => current.map((batch) => changed.get(batch.id) ?? batch));
      }
      setMessage({ tone: "green", text: `${order.orderNumber} is now ${status}. Inventory updated.` });
    } catch {
      setOrders((current) => current.map((candidate) => candidate.id === order.id ? order : candidate));
      setMessage({ tone: "red", text: "Order status could not be updated. Try again in a moment." });
    } finally {
      setUpdatingStatusIds((current) => current.filter((id) => id !== order.id));
    }
  }

  function statusControl(order: Order) {
    const updating = updatingStatusIds.includes(order.id);
    return (
      <select
        aria-label={`Status for ${order.orderNumber}`}
        className={`h-8 rounded-full border px-3 text-xs font-semibold capitalize shadow-sm outline-none focus:ring-2 focus:ring-ring/30 ${statusSelectClasses[order.status]}`}
        value={order.status}
        onChange={(event) => changeStatus(order, event.target.value as Order["status"])}
        disabled={updating || removingOrderIds.includes(order.id) || savingOrderId === order.id}
      >
        {orderStatuses.map((status) => <option key={status} value={status}>{updating && status === order.status ? "Updating..." : status}</option>)}
      </select>
    );
  }

  async function removeOrder(order: Order) {
    if (savingOrderId === order.id || removingOrderIds.includes(order.id)) return;

    const confirmed = window.confirm(`Remove ${order.orderNumber}? Inventory will be restored for the products in this order.`);

    if (!confirmed) return;

    setRemovingOrderIds((current) => [...current, order.id]);
    setOrders((current) => current.filter((candidate) => candidate.id !== order.id));
    setMessage({ tone: "amber", text: `Removing ${order.orderNumber}...` });

    try {
      const response = await fetch(`/api/orders?orderId=${encodeURIComponent(order.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setOrders((current) => visibleOrders([...current, order]));
        setMessage({ tone: "red", text: payload.error ?? "Order could not be removed." });
        return;
      }

      setMessage({ tone: "green", text: `${order.orderNumber} removed and stock restored.` });
    } catch {
      setOrders((current) => visibleOrders([...current, order]));
      setMessage({ tone: "red", text: "Order could not be removed. Check the local dev server and try again." });
    } finally {
      setRemovingOrderIds((current) => current.filter((id) => id !== order.id));
    }
  }

  function renderEditPanel(order: Order) {
    const savingThisOrder = savingOrderId === order.id;

    return (
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Order date</span>
            <Input className="mt-1" type="date" value={editCreatedAt} onChange={(event) => setEditCreatedAt(event.target.value)} />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Payment</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={editPaymentMethod} onChange={(event) => setEditPaymentMethod(event.target.value as (typeof paymentMethods)[number])}>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Who got paid</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={editPaidTo} onChange={(event) => setEditPaidTo(event.target.value as PaymentRecipient | "")}>
              <option value="">Unassigned</option>
              {paymentRecipients.map((recipient) => (
                <option key={recipient} value={recipient}>{paymentRecipientLabels[recipient]}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={editStatus} onChange={(event) => setEditStatus(event.target.value as Order["status"])}>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Notes</span>
            <Input className="mt-1" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
          </label>
        </div>
        <div className="space-y-2">
          {editLines.map((line) => {
            const product = productsById.get(line.productId);
            const availableBatches = product ? batchesByProductId.get(product.id) ?? [] : [];
            const batch = line.inventoryBatchId ? batchesById.get(line.inventoryBatchId) : undefined;
            const lineQuantityForBatch = batch ? editQuantityByBatch.get(batch.id) ?? 0 : 0;
            const availableForBatch = batch ? batch.quantityOnHand + (originalQuantityByBatch.get(batch.id) ?? 0) - batch.quantityReserved : 0;
            const lineOverAllocated = Boolean(batch && (batch.status !== "available" || availableForBatch < lineQuantityForBatch));
            const lineTotal = dollarsToCents(line.unitPrice) * line.quantity;

            return (
              <div key={line.id} className={`grid gap-2 rounded-md border p-3 lg:grid-cols-[minmax(230px,1fr)_140px_90px_130px_110px_36px] lg:items-end ${lineOverAllocated ? "border-amber-200 bg-amber-50" : "bg-slate-50"}`}>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">SKU</span>
                  <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={line.productId} onChange={(event) => updateEditLine(line.id, { productId: event.target.value })}>
                    <option value="">Select SKU</option>
                    {initialProducts.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{productOptionLabel(candidate)}</option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-slate-500">{product ? product.strengthLabel : "Choose a SKU"}</div>
                </label>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Stock count</div>
                  <div className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950">
                    {batch ? `${formatNumber(Math.max(availableForBatch, 0))} available` : "Select SKU"}
                  </div>
                  <select className="sr-only" value={line.inventoryBatchId} onChange={(event) => updateEditLine(line.id, { inventoryBatchId: event.target.value })}>
                    <option value="">Select stock</option>
                    {availableBatches.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.id}</option>)}
                  </select>
                </div>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Qty</span>
                  <Input className="mt-1 bg-white" min={1} type="number" value={line.quantity} onChange={(event) => updateEditLine(line.id, { quantity: Math.max(Number(event.target.value), 1) })} />
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Unit price</span>
                  <Input className="mt-1 bg-white" value={line.unitPrice} onChange={(event) => updateEditLine(line.id, { unitPrice: event.target.value })} />
                </label>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Total</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">{formatCurrency(lineTotal)}</div>
                </div>
                <Button variant="ghost" className="h-9 px-0" onClick={() => setEditLines((current) => (current.length === 1 ? current : current.filter((candidate) => candidate.id !== line.id)))} disabled={savingThisOrder}>
                  <Trash2 size={15} />
                </Button>
                {lineOverAllocated ? (
                  <div className="text-xs font-medium text-amber-800 lg:col-span-6">
                    This line exceeds available stock.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {allocationIssues.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {allocationIssues[0]}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="secondary" onClick={() => setEditLines((current) => [...current, makeLine()])} disabled={savingThisOrder}>
            <Filter size={15} />
            Add item
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditingOrderId(null)} disabled={savingThisOrder}>
              <X size={15} />
              Cancel
            </Button>
            <Button onClick={() => saveEdit(order.id)} disabled={!canSaveEdit || savingThisOrder}>
              <Save size={15} />
              {savingThisOrder ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Order tracking</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Filter, edit, and remove recorded orders with inventory rebalancing.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_160px_170px]">
          <label className="block">
            <span className="sr-only">Search orders</span>
            <Input className="bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, SKU, payment" />
          </label>
          <label className="block">
            <span className="sr-only">Product</span>
            <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
              <option value="all">All products</option>
              {initialProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {productOptionLabel(product)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Payment</span>
            <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="all">All payment</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Status</span>
            <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {message ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <Badge tone={message.tone}>{message.tone === "green" ? "Done" : "Check"}</Badge>
            <span className="ml-2 text-slate-600">{message.text}</span>
          </div>
        ) : null}

        <div className="space-y-3 lg:hidden">
          {filteredOrders.map((order) => {
            const removingThisOrder = removingOrderIds.includes(order.id);

            return (
            <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-950">{order.orderNumber}</div>
                  <div className="mt-1 truncate text-sm text-slate-500">{order.customerName}</div>
                </div>
                <div className="shrink-0">{statusControl(order)}</div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Total</div>
                  <div className="font-semibold text-slate-950">{formatCurrencyOrNA(order.totalCents)}</div>
                </div>
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Payment</div>
                  <div className="font-semibold text-slate-950">{order.paymentMethod}</div>
                </div>
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Status</div>
                  <div className="font-semibold capitalize text-slate-950">{order.status}</div>
                </div>
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Date</div>
                  <div className="truncate font-semibold text-slate-950">{displayDate(order.createdAt)}</div>
                </div>
              </div>

              {order.notes ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold text-slate-950">Notes:</span> {order.notes}
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                {order.items.slice(0, 4).map((item, itemIndex) => (
                  <div key={`${order.id}-${item.productId ?? item.productName}-${item.inventoryBatchId ?? item.batchNumber}-${itemIndex}`} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium text-slate-950">{item.productName}</span>
                      <span className="shrink-0 text-slate-500">{formatNumberOrNA(item.quantity)}x</span>
                    </div>
                  </div>
                ))}
                {order.items.length > 4 ? <div className="text-xs font-medium text-slate-500">+{order.items.length - 4} more items</div> : null}
              </div>

              <div className="mt-3 flex gap-2">
                <Button type="button" variant="secondary" className="h-8 flex-1" onClick={() => startEdit(order)} disabled={removingThisOrder || savingOrderId === order.id}>
                  <Edit3 size={15} />
                  Edit
                </Button>
                <Button type="button" variant="ghost" className="h-8 flex-1 text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => removeOrder(order)} disabled={removingThisOrder}>
                  <Trash2 size={15} />
                  {removingThisOrder ? "Removing..." : "Remove"}
                </Button>
              </div>

              {editingOrderId === order.id ? <div className="mt-3">{renderEditPanel(order)}</div> : null}
            </div>
            );
          })}
        </div>

        <DataTable className="hidden lg:block" columns={["Order", "Customer", "Items", "Payment", "Total", "Status", "Date", "Actions"]}>
          {filteredOrders.map((order) => {
            const removingThisOrder = removingOrderIds.includes(order.id);

            return (
            <Fragment key={order.id}>
              <tr key={order.id}>
                <Td className="max-w-[240px] font-medium text-slate-950">
                  <div>{order.orderNumber}</div>
                  {order.notes ? <div className="mt-1 whitespace-normal text-xs font-normal leading-5 text-slate-500"><span className="font-semibold text-slate-700">Notes:</span> {order.notes}</div> : null}
                </Td>
                <Td>{order.customerName}</Td>
                <Td>{order.items.map((item) => `${formatNumberOrNA(item.quantity)}x ${item.productName}`).join(", ")}</Td>
                <Td><Badge tone={order.paymentStatus === "paid" ? "green" : "amber"}>{order.paymentMethod}</Badge></Td>
                <Td className="font-medium text-slate-950">{formatCurrencyOrNA(order.totalCents)}</Td>
                <Td>{statusControl(order)}</Td>
                <Td>{displayDate(order.createdAt)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="h-8 px-2" onClick={() => startEdit(order)} disabled={removingThisOrder || savingOrderId === order.id}>
                      <Edit3 size={14} />
                      Edit
                    </Button>
                    <Button variant="ghost" className="h-8 px-2 text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => removeOrder(order)} disabled={removingThisOrder}>
                      <Trash2 size={14} />
                      {removingThisOrder ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                </Td>
              </tr>
              {editingOrderId === order.id ? (
                <tr key={`${order.id}-edit`}>
                  <Td colSpan={8} className="bg-slate-50">
                    {renderEditPanel(order)}
                  </Td>
                </tr>
              ) : null}
            </Fragment>
            );
          })}
        </DataTable>

        {filteredOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No orders match the current filters.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
