"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

type ProductCreateFormProps = {
  categories: string[];
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

function dollarsToCents(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
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

export function ProductCreateForm({ categories }: ProductCreateFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);

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

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (invalidForm) {
      setMessage({ tone: "red", text: "Name, SKU, category, strength, and price are required." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productPayload(form))
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Product could not be saved.");
      }

      router.push("/products");
    } catch (caught) {
      setMessage({ tone: "red", text: caught instanceof Error ? caught.message : "Product could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" href="/products">
          <ArrowLeft size={16} />
          Products
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackagePlus size={18} className="text-blue-700" />
            <CardTitle>Add SKU</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProduct} className="space-y-4">
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
                <Input required className="mt-1 bg-white" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} list="product-create-categories" />
                <datalist id="product-create-categories">
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
              <Button type="submit" disabled={saving || invalidForm}>
                <Save size={16} />
                {saving ? "Saving" : "Create SKU"}
              </Button>
            </div>

            {message ? (
              <div className={cn("rounded-lg border p-3 text-sm", message.tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                {message.text}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
