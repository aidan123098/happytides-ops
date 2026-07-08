"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Edit3, ExternalLink, Plus, Save, Search, Trash2, X } from "lucide-react";
import type { Product } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

type ProductForm = {
  name: string;
  sku: string;
  category: string;
  peptideType: string;
  strengthLabel: string;
  price: string;
  costOfGoods: string;
  active: boolean;
  colorAccent: string;
  description: string;
  coaUrl: string;
  researchUseDisclaimer: string;
  imageUrl: string;
  inventoryTrackingEnabled: boolean;
};

const disclaimer = "For research use only. Not for human or veterinary use.";
const colorSwatches = ["#0f172a", "#1d4ed8", "#047857", "#c2410c", "#7c3aed", "#be123c"];

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  category: "",
  peptideType: "",
  strengthLabel: "",
  price: "",
  costOfGoods: "",
  active: true,
  colorAccent: "#1d4ed8",
  description: "",
  coaUrl: "",
  researchUseDisclaimer: disclaimer,
  imageUrl: "",
  inventoryTrackingEnabled: true
};

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function productToForm(product: Product): ProductForm {
  return {
    name: product.name,
    sku: product.sku,
    category: product.category,
    peptideType: product.peptideType,
    strengthLabel: product.strengthLabel,
    price: centsToDollars(product.priceCents),
    costOfGoods: centsToDollars(product.costOfGoodsCents),
    active: product.active,
    colorAccent: product.colorAccent,
    description: product.description,
    coaUrl: product.coaUrl === "N/A" ? "" : product.coaUrl,
    researchUseDisclaimer: product.researchUseDisclaimer || disclaimer,
    imageUrl: product.imageUrl,
    inventoryTrackingEnabled: product.inventoryTrackingEnabled
  };
}

function productPayload(form: ProductForm) {
  return {
    name: form.name.trim(),
    sku: form.sku.trim(),
    category: form.category.trim(),
    peptideType: form.peptideType.trim(),
    strengthLabel: form.strengthLabel.trim(),
    priceCents: dollarsToCents(form.price),
    costOfGoodsCents: dollarsToCents(form.costOfGoods),
    active: form.active,
    colorAccent: form.colorAccent,
    description: form.description.trim(),
    coaUrl: form.coaUrl.trim() || undefined,
    researchUseDisclaimer: form.researchUseDisclaimer.trim() || disclaimer,
    imageUrl: form.imageUrl.trim(),
    inventoryTrackingEnabled: form.inventoryTrackingEnabled
  };
}

function coaLabel(product: Product) {
  return product.coaUrl === "N/A" || !product.coaUrl ? "Missing" : "Linked";
}

export function ProductsWorkbench({ products: initialProducts }: { products: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [archivingProductId, setArchivingProductId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "green" | "amber" | "red"; text: string } | null>(null);

  const categories = useMemo(() => [...new Set(products.map((product) => product.category))].sort(), [products]);
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        const matchesSearch = [product.name, product.sku, product.category, product.peptideType, product.strengthLabel, product.description]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesCategory = category === "all" || product.category === category;
        const matchesStatus = status === "all" || (status === "active" ? product.active : !product.active);
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((left, right) => right.revenueWeekCents - left.revenueWeekCents || left.name.localeCompare(right.name));
  }, [category, products, search, status]);

  const invalidForm =
    !form.name.trim() ||
    !form.sku.trim() ||
    !form.category.trim() ||
    !form.peptideType.trim() ||
    !form.strengthLabel.trim() ||
    dollarsToCents(form.price) <= 0 ||
    dollarsToCents(form.costOfGoods) < 0 ||
    !/^#[0-9a-fA-F]{6}$/.test(form.colorAccent) ||
    form.researchUseDisclaimer.trim().length < 10;

  function resetForm() {
    setShowForm(false);
    setEditingProductId(null);
    setForm(emptyForm);
  }

  function startEdit(product: Product) {
    setMessage(null);
    setEditingProductId(product.id);
    setForm(productToForm(product));
    setShowForm(true);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    if (invalidForm) {
      setMessage({ tone: "red", text: "Name, SKU, category, strength, and price are required." });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/products", {
        method: editingProductId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProductId ? { ...productPayload(form), productId: editingProductId } : productPayload(form))
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Product could not be saved.");
      }

      setProducts((current) => {
        if (editingProductId) {
          return current.map((product) => (product.id === editingProductId ? payload.product : product));
        }
        return [payload.product, ...current];
      });
      setMessage({ tone: "green", text: editingProductId ? `${payload.product.sku} updated.` : `${payload.product.sku} added to the catalog.` });
      resetForm();
    } catch (caught) {
      setMessage({ tone: "red", text: caught instanceof Error ? caught.message : "Product could not be saved." });
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveProduct(product: Product) {
    if (archivingProductId || isSaving) return;
    if (!window.confirm(`Archive ${product.sku}? Existing order history will stay intact.`)) return;

    setArchivingProductId(product.id);
    setMessage({ tone: "amber", text: `Archiving ${product.sku}...` });

    try {
      const response = await fetch(`/api/products?productId=${encodeURIComponent(product.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({ tone: "red", text: payload.error || "Product could not be archived." });
        return;
      }

      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (editingProductId === product.id) resetForm();
      setMessage({ tone: "green", text: `${product.sku} archived.` });
    } catch {
      setMessage({ tone: "red", text: "Product could not be archived. Check the local dev server and try again." });
    } finally {
      setArchivingProductId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Catalog control</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Manage SKUs, pricing, COAs, active selling status, and catalog readiness from one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="blue">{formatNumber(filteredProducts.length)} SKUs</Badge>
          <Link className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring" href="/products/new">
            <Plus size={16} />
            Add SKU
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form onSubmit={saveProduct} className="space-y-4 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Product</span>
                <Input required className="mt-1 bg-white" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">SKU</span>
                <Input required className="mt-1 bg-white font-mono" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">Category</span>
                <Input required className="mt-1 bg-white" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} list="product-categories" />
                <datalist id="product-categories">
                  {categories.map((item) => <option key={item} value={item} />)}
                </datalist>
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
                <Input required className="mt-1 bg-white" value={form.peptideType} onChange={(event) => setForm({ ...form, peptideType: event.target.value })} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">Strength</span>
                <Input required className="mt-1 bg-white" value={form.strengthLabel} onChange={(event) => setForm({ ...form, strengthLabel: event.target.value })} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">Price</span>
                <Input required className="mt-1 bg-white" inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="125.00" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">COGS</span>
                <Input className="mt-1 bg-white" inputMode="decimal" value={form.costOfGoods} onChange={(event) => setForm({ ...form, costOfGoods: event.target.value })} placeholder="42.00" />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-500">COA URL</span>
                <Input className="mt-1 bg-white" value={form.coaUrl} onChange={(event) => setForm({ ...form, coaUrl: event.target.value })} placeholder="https://..." />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Image URL</span>
                <Input className="mt-1 bg-white" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." />
              </label>
              <label className="xl:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Accent</span>
                <div className="mt-1 flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 shadow-sm">
                  {colorSwatches.map((color) => (
                    <button
                      aria-label={`Use ${color}`}
                      className={cn("h-5 w-5 rounded-full ring-2 ring-transparent", form.colorAccent === color && "ring-slate-950")}
                      key={color}
                      onClick={() => setForm({ ...form, colorAccent: color })}
                      style={{ backgroundColor: color }}
                      type="button"
                    />
                  ))}
                  <Input className="h-7 border-0 px-1 font-mono shadow-none focus:ring-0" value={form.colorAccent} onChange={(event) => setForm({ ...form, colorAccent: event.target.value })} />
                </div>
              </label>
              <label className="md:col-span-2 xl:col-span-3">
                <span className="text-xs font-semibold uppercase text-slate-500">Description</span>
                <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
              <label className="md:col-span-2 xl:col-span-3">
                <span className="text-xs font-semibold uppercase text-slate-500">Research disclaimer</span>
                <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={form.researchUseDisclaimer} onChange={(event) => setForm({ ...form, researchUseDisclaimer: event.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                  Active
                </label>
                <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.inventoryTrackingEnabled} onChange={(event) => setForm({ ...form, inventoryTrackingEnabled: event.target.checked })} />
                  Track inventory
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={resetForm} disabled={isSaving}>
                  <X size={15} />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || invalidForm}>
                  <Save size={15} />
                  {isSaving ? "Saving..." : editingProductId ? "Save SKU" : "Create SKU"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}

        {message ? (
          <div className={cn("rounded-lg border p-3 text-sm", message.tone === "red" ? "border-red-200 bg-red-50 text-red-700" : message.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
            {message.text}
          </div>
        ) : null}

        <div className="grid gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_220px_160px]">
          <label>
            <span className="sr-only">Search products</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="bg-white pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU, product, category" />
            </div>
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="space-y-3 md:hidden">
          {filteredProducts.map((product) => {
            const archivingThisProduct = archivingProductId === product.id;

            return (
            <div key={product.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-1.5 rounded-full" style={{ backgroundColor: product.colorAccent }} />
                    <div className="font-semibold text-slate-950">{product.name}</div>
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{product.sku} / {product.strengthLabel}</div>
                </div>
                <Badge tone={product.active ? "green" : "slate"}>{product.active ? "Active" : "Inactive"}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Price</div><div className="font-semibold text-slate-950">{formatCurrency(product.priceCents)}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Margin</div><div className="font-semibold text-slate-950">{formatPercent(product.marginPercent)}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Week units</div><div className="font-semibold text-slate-950">{formatNumber(product.unitsSoldWeek)}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">COA</div><div className="font-semibold text-slate-950">{coaLabel(product)}</div></div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="secondary" className="h-8 flex-1" onClick={() => startEdit(product)} disabled={archivingThisProduct}><Edit3 size={15} /> Edit</Button>
                <Button type="button" variant="ghost" className="h-8 flex-1 text-red-600 hover:text-red-700" onClick={() => archiveProduct(product)} disabled={archivingThisProduct}><Trash2 size={15} /> {archivingThisProduct ? "Archiving..." : "Archive"}</Button>
              </div>
            </div>
            );
          })}
        </div>

        <DataTable className="hidden md:block" columns={["Product", "SKU", "Category", "Strength", "Price", "COGS", "Margin", "Week", "COA", "Status", "Actions"]}>
          {filteredProducts.map((product) => {
            const archivingThisProduct = archivingProductId === product.id;

            return (
            <tr key={product.id}>
              <Td>
                <div className="flex items-center gap-3">
                  <span className="h-8 w-2 rounded-full" style={{ backgroundColor: product.colorAccent }} />
                  <div>
                    <div className="font-medium text-slate-950">{product.name}</div>
                    <div className="text-xs text-slate-500">{product.peptideType}</div>
                  </div>
                </div>
              </Td>
              <Td className="font-mono text-xs">{product.sku}</Td>
              <Td>{product.category}</Td>
              <Td>{product.strengthLabel}</Td>
              <Td className="font-medium text-slate-950">{formatCurrency(product.priceCents)}</Td>
              <Td>{formatCurrency(product.costOfGoodsCents)}</Td>
              <Td><Badge tone={product.marginPercent >= 65 ? "green" : product.marginPercent >= 45 ? "blue" : "amber"}>{formatPercent(product.marginPercent)}</Badge></Td>
              <Td>
                <div className="font-medium text-slate-950">{formatNumber(product.unitsSoldWeek)} units</div>
              </Td>
              <Td>
                {product.coaUrl === "N/A" || !product.coaUrl ? (
                  <Badge tone="amber">Missing</Badge>
                ) : (
                  <a className="inline-flex items-center gap-1 text-blue-700 hover:underline" href={product.coaUrl} rel="noreferrer" target="_blank">
                    COA <ExternalLink size={13} />
                  </a>
                )}
              </Td>
              <Td><Badge tone={product.active ? "green" : "slate"}>{product.active ? "Active" : "Inactive"}</Badge></Td>
              <Td>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" className="h-8 px-2" onClick={() => startEdit(product)} disabled={archivingThisProduct}><Edit3 size={15} /></Button>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700" onClick={() => archiveProduct(product)} disabled={archivingThisProduct}><Trash2 size={15} /></Button>
                </div>
              </Td>
            </tr>
            );
          })}
        </DataTable>

        {filteredProducts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No products match the current filters.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
