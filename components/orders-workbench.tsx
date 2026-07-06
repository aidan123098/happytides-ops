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
import { formatCurrency, formatCurrencyOrNA, formatNumberOrNA } from "@/lib/utils";

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
const paymentStatuses = ["paid", "pending", "refunded", "canceled"] as const;

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
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
  const [editLocation, setEditLocation] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<(typeof paymentMethods)[number]>("Zelle");
  const [editNotes, setEditNotes] = useState("");
  const [message, setMessage] = useState<{ tone: "green" | "amber" | "red"; text: string } | null>(null);

  const batchByProductId = useMemo(() => new Map(inventoryBatches.map((batch) => [batch.productId, batch])), [inventoryBatches]);
  const productsById = useMemo(() => new Map(initialProducts.map((product) => [product.id, product])), [initialProducts]);

  const filteredOrders = orders.filter((order) => {
    const haystack = [
      order.orderNumber,
      order.customerName,
      order.location,
      order.paymentMethod,
      order.paymentStatus,
      order.fulfillmentStatus,
      ...order.items.flatMap((item) => [item.productName, item.batchNumber, item.lotNumber])
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesProduct = productFilter === "all" || order.items.some((item) => item.productId === productFilter || item.productName === productsById.get(productFilter)?.name);
    const matchesPayment = paymentFilter === "all" || order.paymentMethod === paymentFilter;
    const matchesStatus = statusFilter === "all" || order.paymentStatus === statusFilter;

    return matchesSearch && matchesProduct && matchesPayment && matchesStatus;
  });

  function orderType(order: Order) {
    return order.squareOrderId || order.squarePaymentId ? "Square" : "Manual";
  }

  function hydrateLine(order: Order): EditableLine[] {
    return order.items.map((item) => {
      const product = item.productId ? productsById.get(item.productId) : initialProducts.find((candidate) => candidate.name === item.productName);
      const batch = item.inventoryBatchId ? inventoryBatches.find((candidate) => candidate.id === item.inventoryBatchId) : product ? batchByProductId.get(product.id) : undefined;

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
    setEditLocation(order.location);
    setEditPaymentMethod(paymentMethods.includes(order.paymentMethod as (typeof paymentMethods)[number]) ? (order.paymentMethod as (typeof paymentMethods)[number]) : "Other");
    setEditNotes(order.notes ?? "");
  }

  function updateEditLine(id: string, patch: Partial<EditableLine>) {
    setEditLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };

        if (patch.productId !== undefined) {
          const product = productsById.get(patch.productId);
          const batch = product ? batchByProductId.get(product.id) : undefined;
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

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        customerId: orders.find((order) => order.id === orderId)?.customerId ?? "cust_placeholder",
        affiliateId: orders.find((order) => order.id === orderId)?.affiliateId,
        locationId: editLocation.trim() || "Manual entry",
        paymentMethod: editPaymentMethod,
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
            <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All status</option>
              {paymentStatuses.map((status) => (
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

        <DataTable columns={["Order", "Customer", "Affiliate", "Location", "Items", "Payment", "Type", "Total", "Status", "Actions"]}>
          {filteredOrders.map((order) => (
            <Fragment key={order.id}>
              <tr key={order.id}>
                <Td className="font-medium text-slate-950">{order.orderNumber}</Td>
                <Td>{order.customerName}</Td>
                <Td>{order.affiliateName ?? "N/A"}</Td>
                <Td>{order.location}</Td>
                <Td>{order.items.map((item) => `${formatNumberOrNA(item.quantity)}x ${item.productName}`).join(", ")}</Td>
                <Td><Badge tone={order.paymentStatus === "paid" ? "green" : "amber"}>{order.paymentMethod}</Badge></Td>
                <Td>{orderType(order)}</Td>
                <Td className="font-medium text-slate-950">{formatCurrencyOrNA(order.totalCents)}</Td>
                <Td><Badge tone={order.fulfillmentStatus === "fulfilled" ? "green" : "slate"}>{order.fulfillmentStatus}</Badge></Td>
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
                  <Td colSpan={10} className="bg-slate-50">
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-3 md:grid-cols-3">
                        <label>
                          <span className="text-xs font-semibold uppercase text-slate-500">Location/type note</span>
                          <Input className="mt-1" value={editLocation} onChange={(event) => setEditLocation(event.target.value)} />
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
                          <span className="text-xs font-semibold uppercase text-slate-500">Notes</span>
                          <Input className="mt-1" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                        </label>
                      </div>
                      <div className="space-y-2">
                        {editLines.map((line) => {
                          const product = productsById.get(line.productId);
                          const batch = product ? batchByProductId.get(product.id) : undefined;
                          const lineTotal = dollarsToCents(line.unitPrice) * line.quantity;

                          return (
                            <div key={line.id} className="grid gap-2 rounded-md border bg-slate-50 p-3 lg:grid-cols-[minmax(220px,1fr)_90px_130px_110px_36px] lg:items-end">
                              <label>
                                <span className="text-xs font-semibold uppercase text-slate-500">SKU</span>
                                <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={line.productId} onChange={(event) => updateEditLine(line.id, { productId: event.target.value })}>
                                  <option value="">Select SKU</option>
                                  {initialProducts.map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>{productOptionLabel(candidate)}</option>
                                  ))}
                                </select>
                                <div className="mt-1 text-xs text-slate-500">{batch ? `${batch.quantityOnHand} on hand - ${batch.supplier}` : "N/A"}</div>
                              </label>
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
                            </div>
                          );
                        })}
                      </div>
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
                          <Button onClick={() => saveEdit(order.id)}>
                            <Save size={15} />
                            Save changes
                          </Button>
                        </div>
                      </div>
                    </div>
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
