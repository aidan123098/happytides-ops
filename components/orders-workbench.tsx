"use client";

import { Fragment, useMemo, useState } from "react";
import { Edit3, Filter, Save, Trash2, X } from "lucide-react";
import type { InventoryBatch, Order, Product } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { productOptionLabel } from "@/lib/product-labels";
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
const fulfillmentStatuses = ["unfulfilled", "packed", "shipped", "delivered"] as const;

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

function fulfillmentTone(status: Order["fulfillmentStatus"]) {
  if (status === "delivered" || status === "fulfilled") return "green";
  if (status === "shipped") return "blue";
  if (status === "packed") return "amber";
  return "slate";
}

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
  return orders.filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled");
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
  const [editFulfillmentStatus, setEditFulfillmentStatus] = useState<(typeof fulfillmentStatuses)[number]>("unfulfilled");
  const [editCreatedAt, setEditCreatedAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [message, setMessage] = useState<{ tone: "green" | "amber" | "red"; text: string } | null>(null);

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

    for (const item of editingOrder?.items ?? []) {
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
      order.createdAt,
      ...order.items.map((item) => item.productName)
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesProduct = productFilter === "all" || order.items.some((item) => item.productId === productFilter || item.productName === productsById.get(productFilter)?.name);
    const matchesPayment = paymentFilter === "all" || order.paymentMethod === paymentFilter;
    const matchesStatus = statusFilter === "all" || order.fulfillmentStatus === statusFilter;

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
    setEditFulfillmentStatus(fulfillmentStatuses.includes(order.fulfillmentStatus as (typeof fulfillmentStatuses)[number]) ? (order.fulfillmentStatus as (typeof fulfillmentStatuses)[number]) : "unfulfilled");
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

  async function refreshInventory() {
    const response = await fetch("/api/inventory");
    const payload = await response.json();
    setInventoryBatches(payload.batches);
  }

  async function saveEdit(orderId: string) {
    const invalidLine = editLines.find((line) => !line.productId || !line.inventoryBatchId || line.quantity < 1 || dollarsToCents(line.unitPrice) <= 0);

    if (invalidLine) {
      setMessage({ tone: "red", text: "Choose a SKU, quantity, and unit price before saving the order." });
      return;
    }

    if (!canSaveEdit) {
      setMessage({ tone: "red", text: allocationIssues[0] ?? "Fix inventory allocation before saving." });
      return;
    }

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        customerId: orders.find((order) => order.id === orderId)?.customerId ?? "cust_placeholder",
        affiliateId: orders.find((order) => order.id === orderId)?.affiliateId,
        paymentMethod: editPaymentMethod,
        fulfillmentStatus: editFulfillmentStatus,
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
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ tone: "red", text: payload.error ?? "Order could not be updated." });
      return;
    }

    setOrders((current) => current.map((order) => (order.id === orderId ? payload.order : order)));
    await refreshInventory();
    setEditingOrderId(null);
    setMessage({ tone: "green", text: `${payload.order.orderNumber} updated and inventory rebalanced.` });
  }

  async function removeOrder(order: Order) {
    const confirmed = window.confirm(`Remove ${order.orderNumber}? Inventory will be restored for the products in this order.`);

    if (!confirmed) return;

    const response = await fetch(`/api/orders?orderId=${encodeURIComponent(order.id)}`, { method: "DELETE" });
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ tone: "red", text: payload.error ?? "Order could not be removed." });
      return;
    }

    setOrders((current) => current.filter((candidate) => candidate.id !== order.id));
    await refreshInventory();
    setMessage({ tone: "green", text: `${order.orderNumber} removed and stock restored.` });
  }

  function renderEditPanel(order: Order) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
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
            <span className="text-xs font-semibold uppercase text-slate-500">Fulfillment</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={editFulfillmentStatus} onChange={(event) => setEditFulfillmentStatus(event.target.value as (typeof fulfillmentStatuses)[number])}>
              {fulfillmentStatuses.map((status) => (
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
                <Button variant="ghost" className="h-9 px-0" onClick={() => setEditLines((current) => (current.length === 1 ? current : current.filter((candidate) => candidate.id !== line.id)))}>
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
          <Button variant="secondary" onClick={() => setEditLines((current) => [...current, makeLine()])}>
            <Filter size={15} />
            Add item
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditingOrderId(null)}>
              <X size={15} />
              Cancel
            </Button>
            <Button onClick={() => saveEdit(order.id)} disabled={!canSaveEdit}>
              <Save size={15} />
              Save changes
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
        <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 md:grid-cols-[minmax(180px,1fr)_180px_180px_150px]">
          <label className="block">
            <span className="text-xs font-semibold uppercase text-slate-500">Search</span>
            <Input className="mt-1 bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, SKU, payment" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase text-slate-500">Product</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
              <option value="all">All products</option>
              {initialProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {productOptionLabel(product)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase text-slate-500">Payment</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="all">All payment</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase text-slate-500">Fulfillment</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All fulfillment</option>
              {fulfillmentStatuses.map((status) => (
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
          {filteredOrders.map((order) => (
            <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-950">{order.orderNumber}</div>
                  <div className="mt-1 truncate text-sm text-slate-500">{order.customerName}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge tone={order.paymentStatus === "paid" ? "green" : "amber"}>{order.paymentStatus}</Badge>
                  <Badge tone={fulfillmentTone(order.fulfillmentStatus)}>{order.fulfillmentStatus === "fulfilled" ? "delivered" : order.fulfillmentStatus}</Badge>
                </div>
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
                  <div className="text-xs text-slate-500">Fulfillment</div>
                  <div className="font-semibold text-slate-950">{order.fulfillmentStatus === "fulfilled" ? "delivered" : order.fulfillmentStatus}</div>
                </div>
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Date</div>
                  <div className="truncate font-semibold text-slate-950">{displayDate(order.createdAt)}</div>
                </div>
              </div>

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
                <Button type="button" variant="secondary" className="h-8 flex-1" onClick={() => startEdit(order)}>
                  <Edit3 size={15} />
                  Edit
                </Button>
                <Button type="button" variant="ghost" className="h-8 flex-1 text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => removeOrder(order)}>
                  <Trash2 size={15} />
                  Remove
                </Button>
              </div>

              {editingOrderId === order.id ? <div className="mt-3">{renderEditPanel(order)}</div> : null}
            </div>
          ))}
        </div>

        <DataTable className="hidden lg:block" columns={["Order", "Customer", "Items", "Payment", "Total", "Fulfillment", "Date", "Actions"]}>
          {filteredOrders.map((order) => (
            <Fragment key={order.id}>
              <tr key={order.id}>
                <Td className="font-medium text-slate-950">{order.orderNumber}</Td>
                <Td>{order.customerName}</Td>
                <Td>{order.items.map((item) => `${formatNumberOrNA(item.quantity)}x ${item.productName}`).join(", ")}</Td>
                <Td><Badge tone={order.paymentStatus === "paid" ? "green" : "amber"}>{order.paymentMethod}</Badge></Td>
                <Td className="font-medium text-slate-950">{formatCurrencyOrNA(order.totalCents)}</Td>
                <Td><Badge tone={fulfillmentTone(order.fulfillmentStatus)}>{order.fulfillmentStatus === "fulfilled" ? "delivered" : order.fulfillmentStatus}</Badge></Td>
                <Td>{displayDate(order.createdAt)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="h-8 px-2" onClick={() => startEdit(order)}>
                      <Edit3 size={14} />
                      Edit
                    </Button>
                    <Button variant="ghost" className="h-8 px-2 text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => removeOrder(order)}>
                      <Trash2 size={14} />
                      Remove
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
          ))}
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
