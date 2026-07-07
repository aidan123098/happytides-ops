"use client";

import { Edit3, HandCoins, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Affiliate } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrencyOrNA, formatPercentOrNA } from "@/lib/utils";

type AffiliateForm = {
  name: string;
  code: string;
  affiliateType: Affiliate["affiliateType"];
  status: "active" | "paused" | "pending";
  payoutRate: string;
  notes: string;
};

const emptyForm: AffiliateForm = {
  name: "",
  code: "",
  affiliateType: "online",
  status: "active",
  payoutRate: "20",
  notes: ""
};

const affiliateTypes: Affiliate["affiliateType"][] = ["online", "wholesale", "influencer"];
const statusOptions: AffiliateForm["status"][] = ["active", "paused", "pending"];

function isRealAffiliate(affiliate: Affiliate) {
  return affiliate.id !== "aff_placeholder" && affiliate.name !== "N/A" && affiliate.code !== "N/A";
}

function typeLabel(type: Affiliate["affiliateType"] | undefined) {
  if (type === "wholesale") return "Wholesale";
  if (type === "influencer") return "Influencer";
  return "Online";
}

function affiliateToForm(affiliate: Affiliate): AffiliateForm {
  return {
    name: affiliate.name === "N/A" ? "" : affiliate.name,
    code: affiliate.code === "N/A" ? "" : affiliate.code,
    affiliateType: affiliate.affiliateType ?? "online",
    status: affiliate.status === "N/A" ? "active" : affiliate.status,
    payoutRate: affiliate.payoutRatePercent === null ? "" : String(affiliate.payoutRatePercent),
    notes: affiliate.notes === "N/A" ? "" : affiliate.notes
  };
}

function formPayload(form: AffiliateForm) {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    affiliateType: form.affiliateType,
    status: form.status,
    payoutRatePercent: Number(form.payoutRate) || 0,
    notes: form.notes.trim() || undefined
  };
}

function defaultRateForType(type: Affiliate["affiliateType"]) {
  return type === "wholesale" ? "15" : "20";
}

export function AffiliatesWorkbench({ affiliates: initialAffiliates }: { affiliates: Affiliate[] }) {
  const [affiliates, setAffiliates] = useState(initialAffiliates.filter(isRealAffiliate));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AffiliateForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredAffiliates = useMemo(() => {
    return affiliates.filter((affiliate) => {
      const type = affiliate.affiliateType ?? "online";
      const matchesSearch = [affiliate.name, affiliate.code, affiliate.notes].join(" ").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [affiliates, search, typeFilter]);

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

  function editAffiliate(affiliate: Affiliate) {
    setEditingId(affiliate.id);
    setForm(affiliateToForm(affiliate));
    setShowForm(true);
    setError("");
  }

  async function saveAffiliate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const payload = formPayload(form);
      const response = await fetch("/api/affiliates", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...payload, affiliateId: editingId } : payload)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not save affiliate");
      }

      setAffiliates((current) => {
        if (editingId) {
          return current.map((affiliate) => affiliate.id === editingId ? data.affiliate : affiliate);
        }
        return [data.affiliate, ...current];
      });
      resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save affiliate");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAffiliate(affiliate: Affiliate) {
    if (!window.confirm(`Remove affiliate ${affiliate.name}?`)) return;
    setError("");
    const response = await fetch(`/api/affiliates?affiliateId=${encodeURIComponent(affiliate.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error || "Could not remove affiliate");
      return;
    }

    setAffiliates((current) => current.filter((item) => item.id !== affiliate.id));
    if (editingId === affiliate.id) resetForm();
  }

  async function recordPayout(affiliate: Affiliate) {
    const payoutDueCents = affiliate.payoutDueCents ?? 0;

    if (payoutDueCents <= 0) {
      setError(`${affiliate.name} has no payout due.`);
      return;
    }

    if (!window.confirm(`Record ${formatCurrencyOrNA(payoutDueCents)} payout for ${affiliate.name}?`)) return;

    setError("");
    const response = await fetch("/api/affiliates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        affiliateId: affiliate.id,
        totalPayoutCents: (affiliate.totalPayoutCents ?? 0) + payoutDueCents,
        lastPayoutAt: new Date().toISOString()
      })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error || "Could not record payout");
      return;
    }

    setAffiliates((current) => current.map((item) => item.id === affiliate.id ? data.affiliate : item));
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Affiliate ledger</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Manage affiliate identity, code, type, rate, and notes. Revenue and payouts remain tracked metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="slate">{filteredAffiliates.length || "N/A"}</Badge>
          <Button type="button" onClick={startAdd}>
            <Plus size={16} />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form onSubmit={saveAffiliate} className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="xl:col-span-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Affiliate</span>
              <Input required className="mt-1 bg-white" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Code</span>
              <Input required className="mt-1 bg-white font-mono uppercase" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30"
                value={form.affiliateType}
                onChange={(event) => {
                  const nextType = event.target.value as Affiliate["affiliateType"];
                  setForm({ ...form, affiliateType: nextType, payoutRate: defaultRateForType(nextType) });
                }}
              >
                {affiliateTypes.map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
              <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AffiliateForm["status"] })}>
                {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Rate %</span>
              <Input type="number" min="0" max="100" step="0.01" className="mt-1 bg-white" value={form.payoutRate} onChange={(event) => setForm({ ...form, payoutRate: event.target.value })} placeholder="0" />
            </label>
            <label className="md:col-span-2 xl:col-span-6">
              <span className="text-xs font-semibold uppercase text-slate-500">Notes</span>
              <Input className="mt-1 bg-white" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6">
              <Button type="submit" disabled={isSaving}>
                <Save size={16} />
                {editingId ? "Save affiliate" : "Create affiliate"}
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
            <Input className="mt-1 bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Affiliate, code, note" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              {affiliateTypes.map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-3 md:hidden">
          {filteredAffiliates.map((affiliate) => (
            <div key={affiliate.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-950">{affiliate.name}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{affiliate.code}</div>
                </div>
                <Badge tone={(affiliate.affiliateType ?? "online") === "influencer" ? "amber" : "blue"}>{typeLabel(affiliate.affiliateType)}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Revenue</div><div className="font-semibold text-slate-950">{formatCurrencyOrNA(affiliate.revenueGeneratedCents)}</div></div>
                <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Payout due</div><div className="font-semibold text-slate-950">{formatCurrencyOrNA(affiliate.payoutDueCents)}</div></div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">Rate</span>
                <span className="font-medium text-slate-950">{formatPercentOrNA(affiliate.payoutRatePercent)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">Last paid</span>
                <span className="font-medium text-slate-950">{affiliate.lastPayoutAt}</span>
              </div>
              <div className="mt-3 text-sm text-slate-600">{affiliate.notes}</div>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="secondary" className="h-8 flex-1" onClick={() => editAffiliate(affiliate)}><Edit3 size={15} /> Edit</Button>
                <Button type="button" variant="secondary" className="h-8 flex-1" disabled={(affiliate.payoutDueCents ?? 0) <= 0} onClick={() => recordPayout(affiliate)}><HandCoins size={15} /> Pay</Button>
                <Button type="button" variant="ghost" className="h-8 flex-1 text-red-600 hover:text-red-700" onClick={() => deleteAffiliate(affiliate)}><Trash2 size={15} /> Remove</Button>
              </div>
            </div>
          ))}
        </div>

        <DataTable className="hidden md:block" columns={["Affiliate", "Code", "Type", "Status", "Revenue", "Rate", "Total paid", "Payout due", "Last paid", "Actions"]}>
          {filteredAffiliates.map((affiliate) => (
            <tr key={affiliate.id}>
              <Td className="font-medium text-slate-950">{affiliate.name}</Td>
              <Td className="font-mono text-xs">{affiliate.code}</Td>
              <Td><Badge tone={(affiliate.affiliateType ?? "online") === "influencer" ? "amber" : "blue"}>{typeLabel(affiliate.affiliateType)}</Badge></Td>
              <Td><Badge tone={affiliate.status === "active" ? "green" : affiliate.status === "pending" ? "amber" : "slate"}>{affiliate.status}</Badge></Td>
              <Td>{formatCurrencyOrNA(affiliate.revenueGeneratedCents)}</Td>
              <Td>{formatPercentOrNA(affiliate.payoutRatePercent)}</Td>
              <Td>{formatCurrencyOrNA(affiliate.totalPayoutCents)}</Td>
              <Td className="font-medium text-slate-950">{formatCurrencyOrNA(affiliate.payoutDueCents)}</Td>
              <Td>{affiliate.lastPayoutAt}</Td>
              <Td>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" className="h-8 px-2" onClick={() => editAffiliate(affiliate)}><Edit3 size={15} /></Button>
                  <Button type="button" variant="secondary" className="h-8 px-2" disabled={(affiliate.payoutDueCents ?? 0) <= 0} onClick={() => recordPayout(affiliate)}><HandCoins size={15} /></Button>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700" onClick={() => deleteAffiliate(affiliate)}><Trash2 size={15} /></Button>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
        {filteredAffiliates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No affiliates match the current filters.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
