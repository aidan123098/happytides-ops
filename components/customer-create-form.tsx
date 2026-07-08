"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import type { Customer } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  customerType: Customer["customerType"];
  source: Customer["source"];
  status: Customer["status"];
  smsConsent: boolean;
  emailConsent: boolean;
  tags: string;
  notes: string;
};

const customerTypes: Customer["customerType"][] = ["consumer", "wholesaler"];
const customerSources: Customer["source"][] = ["walk-in", "referral", "Instagram", "website", "other"];
const customerStatuses: Customer["status"][] = ["new", "returning", "inactive"];

const emptyForm: CustomerForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  customerType: "consumer",
  source: "walk-in",
  status: "new",
  smsConsent: false,
  emailConsent: false,
  tags: "",
  notes: ""
};

function typeLabel(type: Customer["customerType"]) {
  return type === "wholesaler" ? "Wholesaler" : "Consumer";
}

function sourceLabel(source: Customer["source"]) {
  if (source === "walk-in") return "Walk-in";
  if (source === "Instagram") return "Instagram";
  return source[0].toUpperCase() + source.slice(1);
}

function statusLabel(status: Customer["status"]) {
  return status[0].toUpperCase() + status.slice(1);
}

function formPayload(form: CustomerForm) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim() || "N/A",
    phone: form.phone.trim() || "N/A",
    customerType: form.customerType,
    smsConsent: form.smsConsent,
    emailConsent: form.emailConsent,
    source: form.source,
    status: form.status,
    tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    notes: form.notes.trim() || undefined
  };
}

export function CustomerCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload(form))
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not save customer");
      }

      router.push("/customers");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" href="/customers">
          <ArrowLeft size={16} />
          Customers
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-blue-700" />
            <CardTitle>Add customer</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveCustomer} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">First</span>
                <Input required className="mt-1 bg-white" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">Last</span>
                <Input required className="mt-1 bg-white" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
              </label>
              <label className="xl:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Email</span>
                <Input type="email" className="mt-1 bg-white" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </label>
              <label className="xl:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Phone</span>
                <Input className="mt-1 bg-white" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
                <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value as Customer["customerType"] })}>
                  {customerTypes.map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">Source</span>
                <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as Customer["source"] })}>
                  {customerSources.map((item) => <option key={item} value={item}>{sourceLabel(item)}</option>)}
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
                <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Customer["status"] })}>
                  {customerStatuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
                </select>
              </label>
              <label className="md:col-span-2 xl:col-span-3">
                <span className="text-xs font-semibold uppercase text-slate-500">Tags</span>
                <Input className="mt-1 bg-white" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="wholesale, follow-up, local" />
              </label>
              <label className="md:col-span-2 xl:col-span-3">
                <span className="text-xs font-semibold uppercase text-slate-500">Notes</span>
                <Input className="mt-1 bg-white" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.smsConsent} onChange={(event) => setForm({ ...form, smsConsent: event.target.checked })} />
                  SMS consent
                </label>
                <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.emailConsent} onChange={(event) => setForm({ ...form, emailConsent: event.target.checked })} />
                  Email consent
                </label>
              </div>
              <Button type="submit" disabled={saving}>
                <Save size={16} />
                {saving ? "Saving" : "Create customer"}
              </Button>
            </div>
            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
