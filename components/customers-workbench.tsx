"use client";

import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Customer } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrencyOrNA, formatNumberOrNA } from "@/lib/utils";

type CustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  customerType: Customer["customerType"];
  smsConsent: boolean;
  emailConsent: boolean;
  notes: string;
};

const emptyForm: CustomerForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  customerType: "consumer",
  smsConsent: false,
  emailConsent: false,
  notes: ""
};

const customerTypes: Customer["customerType"][] = ["consumer", "wholesaler"];

function isRealCustomer(customer: Customer) {
  return customer.id !== "cust_placeholder" && (customer.firstName !== "N/A" || customer.email !== "N/A" || customer.phone !== "N/A");
}

function typeLabel(type: Customer["customerType"] | undefined) {
  return type === "wholesaler" ? "Wholesaler" : "Consumer";
}

function customerToForm(customer: Customer): CustomerForm {
  return {
    firstName: customer.firstName === "N/A" ? "" : customer.firstName,
    lastName: customer.lastName === "N/A" ? "" : customer.lastName,
    email: customer.email === "N/A" ? "" : customer.email,
    phone: customer.phone === "N/A" ? "" : customer.phone,
    customerType: customer.customerType ?? "consumer",
    smsConsent: customer.smsConsent,
    emailConsent: customer.emailConsent,
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
    source: "walk-in",
    status: "new",
    tags: [],
    notes: form.notes.trim() || undefined
  };
}

export function CustomersWorkbench({ customers: initialCustomers }: { customers: Customer[] }) {
  const [customers, setCustomers] = useState(initialCustomers.filter(isRealCustomer));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const type = customer.customerType ?? "consumer";
      const matchesSearch = [customer.firstName, customer.lastName, customer.email, customer.phone, customer.notes]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [customers, search, typeFilter]);

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
            <label className="md:col-span-2 xl:col-span-5">
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

        <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 sm:grid-cols-[minmax(180px,1fr)_170px]">
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Search</span>
            <Input className="mt-1 bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, note" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              {customerTypes.map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}
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
                <Badge tone={(customer.customerType ?? "consumer") === "wholesaler" ? "amber" : "blue"}>{typeLabel(customer.customerType)}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Orders</div><div className="font-semibold text-slate-950">{formatNumberOrNA(customer.orderCount)}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Spend</div><div className="font-semibold text-slate-950">{formatCurrencyOrNA(customer.totalSpendCents)}</div></div>
              </div>
              <div className="mt-3 text-sm text-slate-600">{customer.notes}</div>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="secondary" className="h-8 flex-1" onClick={() => editCustomer(customer)}><Edit3 size={15} /> Edit</Button>
                <Button type="button" variant="ghost" className="h-8 flex-1 text-red-600 hover:text-red-700" onClick={() => deleteCustomer(customer)}><Trash2 size={15} /> Remove</Button>
              </div>
            </div>
          ))}
        </div>

        <DataTable className="hidden md:block" columns={["Customer", "Type", "Contact", "Consent", "Orders", "Spend", "Notes", "Actions"]}>
          {filteredCustomers.map((customer) => (
            <tr key={customer.id}>
              <Td><div className="font-medium text-slate-950">{customer.firstName} {customer.lastName}</div><div className="text-xs text-slate-500">Last purchase {customer.lastPurchaseAt}</div></Td>
              <Td><Badge tone={(customer.customerType ?? "consumer") === "wholesaler" ? "amber" : "blue"}>{typeLabel(customer.customerType)}</Badge></Td>
              <Td><div>{customer.email}</div><div className="text-xs text-slate-500">{customer.phone}</div></Td>
              <Td><div className="flex gap-2"><Badge tone={customer.smsConsent ? "green" : "slate"}>SMS</Badge><Badge tone={customer.emailConsent ? "green" : "slate"}>Email</Badge></div></Td>
              <Td>{formatNumberOrNA(customer.orderCount)}</Td>
              <Td><div className="font-medium text-slate-950">{formatCurrencyOrNA(customer.totalSpendCents)}</div><div className="text-xs text-slate-500">AOV {formatCurrencyOrNA(customer.averageOrderValueCents)}</div></Td>
              <Td>{customer.notes}</Td>
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
