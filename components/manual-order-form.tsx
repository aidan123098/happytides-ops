"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Plus, ReceiptText, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Affiliate, Customer, InventoryBatch, Product } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { productOptionLabel } from "@/lib/product-labels";
import { formatCurrency } from "@/lib/utils";

type ManualOrderFormProps = {
  products: Product[];
  inventoryBatches: InventoryBatch[];
  customers: Customer[];
  affiliates: Affiliate[];
};

type LineItem = {
  id: string;
  sku: string;
  productId: string;
  batchId: string;
  quantity: number;
  unitPrice: string;
};

const paymentMethods = [
  "Processor",
  "Zelle",
  "Venmo",
  "ACH",
  "Crypto",
  "Cash",
  "Other"
] as const;

const customerTypes: Customer["customerType"][] = ["consumer", "wholesaler"];

type CustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  customerType: Customer["customerType"];
  notes: string;
};

const emptyCustomerForm: CustomerForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  customerType: "consumer",
  notes: ""
};

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function newLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    sku: "",
    productId: "",
    batchId: "",
    quantity: 1,
    unitPrice: ""
  };
}

export function ManualOrderForm({ products, inventoryBatches, customers: initialCustomers, affiliates }: ManualOrderFormProps) {
  const searchParams = useSearchParams();
  const realInitialCustomers = initialCustomers.filter((customer) => customer.id !== "cust_placeholder" && (customer.firstName !== "N/A" || customer.email !== "N/A" || customer.phone !== "N/A"));
  const realAffiliates = affiliates.filter((affiliate) => affiliate.id !== "aff_placeholder" && affiliate.name !== "N/A" && affiliate.code !== "N/A");
  const [customers, setCustomers] = useState(realInitialCustomers);
  const [customerId, setCustomerId] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomerForm);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("Zelle");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([newLineItem()]);
  const [status, setStatus] = useState<{ tone: "green" | "amber" | "red"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);

  const batchesByProductId = useMemo(() => {
    const grouped = new Map<string, InventoryBatch[]>();

    for (const batch of inventoryBatches) {
      grouped.set(batch.productId, [...(grouped.get(batch.productId) ?? []), batch]);
    }

    return grouped;
  }, [inventoryBatches]);

  const enrichedItems = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const batches = product ? batchesByProductId.get(product.id) ?? [] : [];
    const batch = batches.find((candidate) => candidate.id === item.batchId) ?? batches[0];
    const unitPriceCents = dollarsToCents(item.unitPrice);
    return {
      ...item,
      product,
      batch,
      batches,
      unitPriceCents,
      lineTotalCents: unitPriceCents * item.quantity
    };
  });

  const subtotalCents = enrichedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const quantityByBatchId = enrichedItems.reduce((accumulator, item) => {
    if (!item.batch?.id) return accumulator;
    accumulator.set(item.batch.id, (accumulator.get(item.batch.id) ?? 0) + item.quantity);
    return accumulator;
  }, new Map<string, number>());
  const overAllocatedItems = enrichedItems.filter((item) => {
    if (!item.batch) return false;
    return (quantityByBatchId.get(item.batch.id) ?? 0) > item.batch.quantityOnHand - item.batch.quantityReserved;
  });
  const invalidItem = enrichedItems.find((item) => !item.product || !item.batch || item.quantity < 1 || item.unitPriceCents <= 0);
  const orderReady = Boolean(customerId) && !addingCustomer && !invalidItem && overAllocatedItems.length === 0 && subtotalCents > 0;

  function updateProduct(id: string, productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    const batch = product ? batchesByProductId.get(product.id)?.[0] : undefined;

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) return item;

        return {
          ...item,
          sku: product?.sku ?? "",
          productId: product?.id ?? "",
          batchId: batch?.id ?? "",
          unitPrice: product ? centsToDollars(product.priceCents) : item.unitPrice
        };
      })
    );
  }

  function updateLine(id: string, patch: Partial<LineItem>) {
    setItems((currentItems) => currentItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeLine(id: string) {
    setItems((currentItems) => (currentItems.length === 1 ? currentItems : currentItems.filter((item) => item.id !== id)));
  }

  async function saveInlineCustomer() {
    if (!customerForm.firstName.trim() || !customerForm.lastName.trim()) {
      setStatus({ tone: "red", message: "Enter a first and last name before adding the customer." });
      return;
    }

    setSavingCustomer(true);
    setStatus(null);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: customerForm.firstName.trim(),
          lastName: customerForm.lastName.trim(),
          email: customerForm.email.trim() || "N/A",
          phone: customerForm.phone.trim() || "N/A",
          customerType: customerForm.customerType,
          smsConsent: false,
          emailConsent: false,
          source: "walk-in",
          status: "new",
          tags: [],
          notes: customerForm.notes.trim() || undefined
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({ tone: "red", message: payload.error ?? "Customer could not be added." });
        return;
      }

      setCustomers((current) => [payload.customer, ...current]);
      setCustomerId(payload.customer.id);
      setCustomerForm(emptyCustomerForm);
      setAddingCustomer(false);
      setStatus({ tone: "green", message: `${payload.customer.firstName} ${payload.customer.lastName} added to the customer list.` });
    } catch {
      setStatus({ tone: "red", message: "Customer could not be added. Check the local dev server and try again." });
    } finally {
      setSavingCustomer(false);
    }
  }

  async function submitOrder() {
    setStatus(null);

    if (invalidItem) {
      setStatus({ tone: "red", message: "Enter a valid catalog SKU, quantity, and unit price before recording the order." });
      return;
    }

    if (!customerId || addingCustomer) {
      setStatus({ tone: "red", message: "Select or add the customer before recording the order." });
      return;
    }

    if (overAllocatedItems.length > 0) {
      const item = overAllocatedItems[0];
      setStatus({ tone: "red", message: `${item.product?.name ?? "Selected product"} only has ${Math.max((item.batch?.quantityOnHand ?? 0) - (item.batch?.quantityReserved ?? 0), 0)} units available.` });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          affiliateId: affiliateId || undefined,
          paymentMethod,
          fulfillmentStatus: "unfulfilled",
          items: enrichedItems.map((item) => ({
            productId: item.productId,
            inventoryBatchId: item.batchId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            discountCents: 0
          })),
          notes: notes.trim()
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus({ tone: "red", message: payload.error ?? "Order could not be recorded." });
        return;
      }

      if (!payload.order) {
        setStatus({ tone: "red", message: "Order was accepted but could not be loaded back into the order list. Refresh and try again." });
        return;
      }

      const returnTo = searchParams.get("returnTo") ?? "/orders";
      setStatus({ tone: "green", message: `Order ${payload.order.orderNumber} recorded locally for ${formatCurrency(payload.order.totalCents)}.` });
      window.location.assign(returnTo);
    } catch {
      setStatus({ tone: "red", message: "Order could not be recorded. Check the local dev server and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-end">
        <div>
          <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
            <ArrowLeft size={16} />
            Orders
          </Link>
          <p className="mt-5 text-sm font-semibold text-blue-700">Manual sales processing</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">New order</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Choose a catalog SKU to auto-load product pricing, then adjust quantity, payment method, and unit price if needed.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-white/90 px-4 py-3 text-sm shadow-panel">
          <div className="text-xs font-semibold uppercase text-slate-500">Order total</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{formatCurrency(subtotalCents)}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cart items</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Choose from the active catalog. Prices auto-fill but remain editable.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setItems((currentItems) => [...currentItems, newLineItem()])}>
              <Plus size={16} />
              Add line
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {enrichedItems.map((item) => (
              <div key={item.id} className={`grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(260px,1.4fr)_150px_90px_130px_110px_36px] lg:items-end ${item.batch && (quantityByBatchId.get(item.batch.id) ?? 0) > item.batch.quantityOnHand - item.batch.quantityReserved ? "border-amber-300 bg-amber-50/80" : "border-slate-200 bg-slate-50/70"}`}>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">SKU</span>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30"
                    value={item.productId}
                    onChange={(event) => updateProduct(item.id, event.target.value)}
                  >
                    <option value="">Select SKU</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {productOptionLabel(product)}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Stock count</div>
                  <div className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950">
                    {item.batch ? `${Math.max(item.batch.quantityOnHand - item.batch.quantityReserved - (quantityByBatchId.get(item.batch.id) ?? 0), 0)} left` : "Select SKU"}
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Qty</span>
                  <Input
                    className="mt-1 bg-white"
                    min={1}
                    type="number"
                    value={item.quantity}
                    onChange={(event) => updateLine(item.id, { quantity: Math.max(Number(event.target.value), 1) })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Unit price</span>
                  <Input className="mt-1 bg-white" value={item.unitPrice} onChange={(event) => updateLine(item.id, { unitPrice: event.target.value })} placeholder="0.00" />
                </label>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Line total</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">{formatCurrency(item.lineTotalCents)}</div>
                </div>
                <Button type="button" variant="ghost" className="h-9 px-0" onClick={() => removeLine(item.id)}>
                  <Trash2 size={16} />
                </Button>
                {item.batch && (quantityByBatchId.get(item.batch.id) ?? 0) > item.batch.quantityOnHand - item.batch.quantityReserved ? (
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 lg:col-span-6">
                    <AlertTriangle size={14} />
                    Cart uses more stock than is currently available.
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Payment</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Record how the in-person order was paid.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Customer</span>
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30"
                value={addingCustomer ? "__add__" : customerId}
                onChange={(event) => {
                  if (event.target.value === "__add__") {
                    setAddingCustomer(true);
                    return;
                  }

                  setAddingCustomer(false);
                  setCustomerId(event.target.value);
                }}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.firstName} {customer.lastName} - {customer.customerType === "wholesaler" ? "Wholesaler" : "Consumer"}
                  </option>
                ))}
                <option value="__add__">+ Add customer</option>
              </select>
            </label>
            {addingCustomer ? (
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">First</span>
                  <Input className="mt-1 bg-white" value={customerForm.firstName} onChange={(event) => setCustomerForm({ ...customerForm, firstName: event.target.value })} />
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Last</span>
                  <Input className="mt-1 bg-white" value={customerForm.lastName} onChange={(event) => setCustomerForm({ ...customerForm, lastName: event.target.value })} />
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Email</span>
                  <Input type="email" className="mt-1 bg-white" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} />
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Phone</span>
                  <Input className="mt-1 bg-white" value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} />
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
                  <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={customerForm.customerType} onChange={(event) => setCustomerForm({ ...customerForm, customerType: event.target.value as Customer["customerType"] })}>
                    {customerTypes.map((type) => (
                      <option key={type} value={type}>{type === "wholesaler" ? "Wholesaler" : "Consumer"}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Notes</span>
                  <Input className="mt-1 bg-white" value={customerForm.notes} onChange={(event) => setCustomerForm({ ...customerForm, notes: event.target.value })} />
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => { setAddingCustomer(false); setCustomerForm(emptyCustomerForm); }}>
                    Cancel
                  </Button>
                  <Button type="button" className="flex-1" onClick={saveInlineCustomer} disabled={savingCustomer}>
                    {savingCustomer ? "Adding..." : "Add customer"}
                  </Button>
                </div>
              </div>
            ) : null}
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Affiliate</span>
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30"
                value={affiliateId}
                onChange={(event) => setAffiliateId(event.target.value)}
              >
                <option value="">No affiliate</option>
                {realAffiliates.map((affiliate) => (
                  <option key={affiliate.id} value={affiliate.id}>
                    {affiliate.name} - {affiliate.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Payment method</span>
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as (typeof paymentMethods)[number])}
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Notes</span>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-ring/30"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional order note"
              />
            </label>
            <div className="rounded-lg bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <ReceiptText size={16} />
                  Total due
                </div>
                <div className="text-2xl font-semibold">{formatCurrency(subtotalCents)}</div>
              </div>
            </div>
            <Button type="button" className="h-10 w-full" onClick={submitOrder} disabled={submitting || !orderReady}>
              <CheckCircle2 size={16} />
              {submitting ? "Recording..." : "Record order"}
            </Button>
            {!orderReady ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                Select a customer and complete each line with a SKU, quantity, and available stock before recording.
              </div>
            ) : null}
            {status ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <Badge tone={status.tone}>{status.tone === "green" ? "Saved" : "Check"}</Badge>
                <p className="mt-2 text-slate-600">{status.message}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
