"use client";

import { Edit3, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { formatCurrencyOrNA, formatNumberOrNA } from "@/lib/utils";

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

const customerTypes: Customer["customerType"][] = ["consumer", "wholesaler"];
const customerSources: Customer["source"][] = ["walk-in", "referral", "Instagram", "website", "other"];
const customerStatuses: Customer["status"][] = ["new", "returning", "inactive"];

function isRealCustomer(customer: Customer) {
  return customer.id !== "cust_placeholder" && (customer.firstName !== "N/A" || customer.email !== "N/A" || customer.phone !== "N/A");
}

function typeLabel(type: Customer["customerType"] | undefined) {
  return type === "wholesaler" ? "Wholesaler" : "Consumer";
}

function sourceLabel(source: Customer["source"] | undefined) {
  if (source === "walk-in") return "Walk-in";
  if (source === "Instagram") return "Instagram";
  return source ? source[0].toUpperCase() + source.slice(1) : "Other";
}

function statusLabel(status: Customer["status"] | undefined) {
  return status ? status[0].toUpperCase() + status.slice(1) : "New";
}

function statusTone(status: Customer["status"] | undefined): "blue" | "green" | "amber" | "slate" {
  if (status === "returning") return "blue";
  if (status === "inactive") return "slate";
  return "amber";
}

function customerToForm(customer: Customer): CustomerForm {
  return {
    firstName: customer.firstName === "N/A" ? "" : customer.firstName,
    lastName: customer.lastName === "N/A" ? "" : customer.lastName,
    email: customer.email === "N/A" ? "" : customer.email,
    phone: customer.phone === "N/A" ? "" : customer.phone,
    customerType: customer.customerType ?? "consumer",
    source: customer.source ?? "walk-in",
    status: customer.status ?? "new",
    smsConsent: customer.smsConsent,
    emailConsent: customer.emailConsent,
    tags: customer.tags.join(", "),
    notes: customer.notes === "N/A" ? "" : customer.notes
  };
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

export function CustomersWorkbench({ customers: initialCustomers }: { customers: Customer[] }) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers.filter(isRealCustomer));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [consentFilter, setConsentFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useLiveRefresh({
    onRefresh: async () => {
      const response = await fetch("/api/customers", { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (Array.isArray(payload?.customers)) setCustomers(payload.customers.filter(isRealCustomer));
      }
      router.refresh();
    }
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const type = customer.customerType ?? "consumer";
      const source = customer.source ?? "walk-in";
      const status = customer.status ?? "new";
      const matchesSearch = [customer.firstName, customer.lastName, customer.email, customer.phone, customer.notes, customer.favoriteProduct, source, status, ...customer.tags]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || type === typeFilter;
      const matchesSource = sourceFilter === "all" || source === sourceFilter;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesConsent =
        consentFilter === "all" ||
        (consentFilter === "sms" && customer.smsConsent) ||
        (consentFilter === "email" && customer.emailConsent) ||
        (consentFilter === "none" && !customer.smsConsent && !customer.emailConsent);
      return matchesSearch && matchesType && matchesSource && matchesStatus && matchesConsent;
    });
  }, [consentFilter, customers, search, sourceFilter, statusFilter, typeFilter]);

  function resetForm() {
    setEditingId(null);
    setShowForm(false);
    setForm(emptyForm);
    setError("");
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
  }

  function editCustomer(customer: Customer) {
    setEditingId(customer.id);
    setForm(customerToForm(customer));
    setShowForm(true);
    setError("");
  }

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const payload = formPayload(form);
      const response = await fetch("/api/customers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...payload, customerId: editingId } : payload)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not save customer");
      }

      setCustomers((current) => {
        if (editingId) {
          return current.map((customer) => customer.id === editingId ? data.customer : customer);
        }
        return [data.customer, ...current];
      });
      resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save customer");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    if (!window.confirm(`Remove ${customer.firstName} ${customer.lastName}?`)) return;
    setError("");
    const response = await fetch(`/api/customers?customerId=${encodeURIComponent(customer.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error || "Could not remove customer");
      return;
    }

    setCustomers((current) => current.filter((item) => item.id !== customer.id));
    if (editingId === customer.id) resetForm();
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Customer database</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Create, edit, search, and manage customer records without storing unnecessary medical information.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="slate">{filteredCustomers.length || "N/A"}</Badge>
          <Button type="button" onClick={startAdd}>
            <Plus size={16} />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form onSubmit={saveCustomer} className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 md:grid-cols-2 xl:grid-cols-6">
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
            <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6">
              <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.smsConsent} onChange={(event) => setForm({ ...form, smsConsent: event.target.checked })} />
                SMS consent
              </label>
              <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.emailConsent} onChange={(event) => setForm({ ...form, emailConsent: event.target.checked })} />
                Email consent
              </label>
              <Button type="submit" disabled={isSaving}>
                <Save size={16} />
                {editingId ? "Save customer" : "Create customer"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                <X size={16} />
                Cancel
              </Button>
              {error ? <span className="text-sm font-medium text-red-600">{error}</span> : null}
            </div>
          </form>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 md:grid-cols-[minmax(180px,1fr)_150px_150px_150px_150px]">
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Search</span>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="bg-white pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, tag" />
            </div>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              {customerTypes.map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Source</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">All sources</option>
              {customerSources.map((item) => <option key={item} value={item}>{sourceLabel(item)}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All status</option>
              {customerStatuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Consent</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={consentFilter} onChange={(event) => setConsentFilter(event.target.value)}>
              <option value="all">All consent</option>
              <option value="sms">SMS yes</option>
              <option value="email">Email yes</option>
              <option value="none">No consent</option>
            </select>
          </label>
        </div>

        <div className="space-y-3 md:hidden">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-950">{customer.firstName} {customer.lastName}</div>
                  <div className="mt-1 text-sm text-slate-500">{customer.email}</div>
                  <div className="text-sm text-slate-500">{customer.phone}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={statusTone(customer.status)}>{statusLabel(customer.status)}</Badge>
                  <Badge tone={(customer.customerType ?? "consumer") === "wholesaler" ? "amber" : "blue"}>{typeLabel(customer.customerType)}</Badge>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Orders</div><div className="font-semibold text-slate-950">{formatNumberOrNA(customer.orderCount)}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Spend</div><div className="font-semibold text-slate-950">{formatCurrencyOrNA(customer.totalSpendCents)}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Source</div><div className="font-semibold text-slate-950">{sourceLabel(customer.source)}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Favorite</div><div className="font-semibold text-slate-950">{customer.favoriteProduct}</div></div>
              </div>
              {customer.tags.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{customer.tags.map((tag) => <Badge key={tag} tone="slate">{tag}</Badge>)}</div> : null}
              <div className="mt-3 text-sm text-slate-600">{customer.notes}</div>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="secondary" className="h-8 flex-1" onClick={() => editCustomer(customer)}><Edit3 size={15} /> Edit</Button>
                <Button type="button" variant="ghost" className="h-8 flex-1 text-red-600 hover:text-red-700" onClick={() => deleteCustomer(customer)}><Trash2 size={15} /> Remove</Button>
              </div>
            </div>
          ))}
        </div>

        <DataTable className="hidden md:block" columns={["Customer", "Status", "Type", "Contact", "Source", "Consent", "Spend", "Favorite", "Actions"]}>
          {filteredCustomers.map((customer) => (
            <tr key={customer.id}>
              <Td>
                <div className="font-medium text-slate-950">{customer.firstName} {customer.lastName}</div>
                <div className="text-xs text-slate-500">Last purchase {customer.lastPurchaseAt}</div>
                {customer.tags.length > 0 ? <div className="mt-2 flex flex-wrap gap-1">{customer.tags.slice(0, 2).map((tag) => <Badge key={tag} tone="slate">{tag}</Badge>)}</div> : null}
              </Td>
              <Td><Badge tone={statusTone(customer.status)}>{statusLabel(customer.status)}</Badge></Td>
              <Td><Badge tone={(customer.customerType ?? "consumer") === "wholesaler" ? "amber" : "blue"}>{typeLabel(customer.customerType)}</Badge></Td>
              <Td><div>{customer.email}</div><div className="text-xs text-slate-500">{customer.phone}</div></Td>
              <Td>{sourceLabel(customer.source)}</Td>
              <Td><div className="flex gap-2"><Badge tone={customer.smsConsent ? "green" : "slate"}>SMS</Badge><Badge tone={customer.emailConsent ? "green" : "slate"}>Email</Badge></div></Td>
              <Td><div className="font-medium text-slate-950">{formatCurrencyOrNA(customer.totalSpendCents)}</div><div className="text-xs text-slate-500">{formatNumberOrNA(customer.orderCount)} orders / AOV {formatCurrencyOrNA(customer.averageOrderValueCents)}</div></Td>
              <Td><div>{customer.favoriteProduct}</div><div className="text-xs text-slate-500">{customer.notes}</div></Td>
              <Td>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" className="h-8 px-2" onClick={() => editCustomer(customer)}><Edit3 size={15} /></Button>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700" onClick={() => deleteCustomer(customer)}><Trash2 size={15} /></Button>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
        {filteredCustomers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No customers match the current filters.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
