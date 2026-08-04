"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Edit3,
  HandCoins,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  UserCheck,
  Users,
  WalletCards,
  X
} from "lucide-react";
import type { Affiliate, AffiliateDetail } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { formatCurrencyOrNA, formatNumberOrNA, formatPercentOrNA } from "@/lib/utils";

type AffiliateStatus = "active" | "paused" | "pending";

type AffiliateForm = {
  name: string;
  code: string;
  status: AffiliateStatus;
  payoutRate: string;
  notes: string;
};

const emptyForm: AffiliateForm = {
  name: "",
  code: "",
  status: "pending",
  payoutRate: "20",
  notes: ""
};

const openApplicationEvent = "happytides:open-affiliate-application";

export function AffiliateApplicationTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        window.history.replaceState(null, "", "#new-affiliate");
        window.dispatchEvent(new Event(openApplicationEvent));
      }}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <Plus size={16} />
      New application
    </button>
  );
}

function isRealAffiliate(affiliate: Affiliate) {
  return affiliate.id !== "aff_placeholder" && affiliate.name !== "N/A" && affiliate.code !== "N/A";
}

function statusLabel(status: Affiliate["status"]) {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "pending") return "Pending";
  if (status === "declined") return "Declined";
  return "Unknown";
}

function statusTone(status: Affiliate["status"]): "green" | "amber" | "slate" {
  if (status === "active") return "green";
  if (status === "pending") return "amber";
  return "slate";
}

function affiliateToForm(affiliate: Affiliate): AffiliateForm {
  return {
    name: affiliate.name === "N/A" ? "" : affiliate.name,
    code: affiliate.code === "N/A" ? "" : affiliate.code,
    status: affiliate.status === "active" || affiliate.status === "paused" ? affiliate.status : "pending",
    payoutRate: affiliate.payoutRatePercent === null ? "" : String(affiliate.payoutRatePercent),
    notes: affiliate.notes === "N/A" ? "" : affiliate.notes
  };
}

function formPayload(form: AffiliateForm) {
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    status: form.status,
    payoutRatePercent: Number(form.payoutRate) || 0,
    notes: form.notes.trim() || undefined
  };
}

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

function displayDate(value: string) {
  if (!value || value === "N/A") return "Not paid yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function activityLabel(action: string) {
  return action.replace(/^AFFILIATE_/, "").replaceAll("_", " ").toLowerCase();
}

function AffiliateDetails({
  affiliate,
  detail,
  loading,
  copied,
  busy,
  onCopy,
  onEdit,
  onPayout
}: {
  affiliate: Affiliate;
  detail?: AffiliateDetail;
  loading: boolean;
  copied: boolean;
  busy: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onPayout: () => void;
}) {
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Partner overview</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-slate-950">{affiliate.name}</span>
            <Badge tone={statusTone(affiliate.status)}>{statusLabel(affiliate.status)}</Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 font-mono text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          title="Copy affiliate code"
        >
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          {affiliate.code}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-md bg-white p-3 ring-1 ring-slate-200/80">
          <div className="text-xs text-slate-500">Attributed sales</div>
          <div className="mt-1 font-semibold text-slate-950">{formatCurrencyOrNA(affiliate.revenueGeneratedCents)}</div>
        </div>
        <div className="rounded-md bg-white p-3 ring-1 ring-slate-200/80">
          <div className="text-xs text-slate-500">Referred orders</div>
          <div className="mt-1 font-semibold text-slate-950">{formatNumberOrNA(affiliate.referredOrders)}</div>
        </div>
        <div className="rounded-md bg-white p-3 ring-1 ring-slate-200/80">
          <div className="text-xs text-slate-500">Referred customers</div>
          <div className="mt-1 font-semibold text-slate-950">{formatNumberOrNA(affiliate.referredCustomers)}</div>
        </div>
        <div className="rounded-md bg-white p-3 ring-1 ring-slate-200/80">
          <div className="text-xs text-slate-500">Commission rate</div>
          <div className="mt-1 font-semibold text-slate-950">{formatPercentOrNA(affiliate.payoutRatePercent)}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Total paid</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{formatCurrencyOrNA(affiliate.totalPayoutCents)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Payout due</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{formatCurrencyOrNA(affiliate.payoutDueCents)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Last paid</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{displayDate(affiliate.lastPayoutAt)}</div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Notes</div>
        <p className="mt-1 text-sm leading-6 text-slate-700">{affiliate.notes && affiliate.notes !== "N/A" ? affiliate.notes : "No notes recorded."}</p>
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading referred orders and activity...</div> : null}
      {!loading && detail ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Referred orders</div>
            <div className="mt-2 space-y-2">
              {detail.orders.length > 0 ? detail.orders.map((order) => (
                <div key={order.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-md bg-white p-3 ring-1 ring-slate-200/80">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-blue-700">{order.orderNumber}</div>
                    <div className="mt-1 truncate text-sm font-medium text-slate-900">{order.customerName}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{displayDate(order.createdAt)} · {order.status}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Product net</div>
                    <div className="text-sm font-semibold text-slate-950">{formatCurrencyOrNA(order.productNetCents)}</div>
                  </div>
                </div>
              )) : <div className="rounded-md bg-white p-3 text-sm text-slate-500 ring-1 ring-slate-200/80">No referred orders yet.</div>}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Management activity</div>
            <div className="mt-2 space-y-2">
              {detail.activity.length > 0 ? detail.activity.map((activity) => (
                <div key={activity.id} className="rounded-md bg-white p-3 ring-1 ring-slate-200/80">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold capitalize text-slate-900">{activityLabel(activity.action)}</span>
                    {activity.amountCents ? <span className="text-sm font-semibold text-slate-950">{formatCurrencyOrNA(activity.amountCents)}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{activity.actorName} · {displayDate(activity.createdAt)}</div>
                  {activity.detail ? <p className="mt-1 text-sm text-slate-600">{activity.detail}</p> : null}
                </div>
              )) : <div className="rounded-md bg-white p-3 text-sm text-slate-500 ring-1 ring-slate-200/80">No management activity recorded yet.</div>}
            </div>
          </div>
        </div>
      ) : null}

      {affiliate.status !== "declined" ? (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onEdit} disabled={busy}>
            <Edit3 size={15} />
            Edit partner
          </Button>
          <Button type="button" className="w-full sm:w-auto" onClick={onPayout} disabled={busy || (affiliate.payoutDueCents ?? 0) <= 0}>
            <HandCoins size={15} />
            Mark paid in full
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function AffiliatesWorkbench({ affiliates: initialAffiliates }: { affiliates: Affiliate[] }) {
  const [affiliates, setAffiliates] = useState(initialAffiliates.filter(isRealAffiliate));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "declined">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, AffiliateDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AffiliateForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const pendingAffiliates = affiliates.filter((affiliate) => affiliate.status === "pending");
  const editingAffiliate = editingId ? affiliates.find((affiliate) => affiliate.id === editingId) : undefined;
  const directoryAffiliates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return affiliates.filter((affiliate) => {
      if (affiliate.status !== "active" && affiliate.status !== "paused" && affiliate.status !== "declined") return false;
      const matchesSearch = !query || [affiliate.name, affiliate.code, affiliate.notes].join(" ").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || affiliate.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [affiliates, search, statusFilter]);

  const metrics = useMemo(() => {
    const liveAffiliates = affiliates.filter((affiliate) => affiliate.status !== "declined");
    return {
      pending: pendingAffiliates.length,
      active: affiliates.filter((affiliate) => affiliate.status === "active").length,
      revenue: liveAffiliates.reduce((sum, affiliate) => sum + (affiliate.revenueGeneratedCents ?? 0), 0),
      payoutDue: liveAffiliates.reduce((sum, affiliate) => sum + (affiliate.payoutDueCents ?? 0), 0)
    };
  }, [affiliates, pendingAffiliates.length]);

  async function refreshAffiliates() {
    const response = await fetch("/api/affiliates?includeArchived=1", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (Array.isArray(data.affiliates)) {
      setAffiliates(data.affiliates.filter(isRealAffiliate));
      setDetails({});
    }
  }

  useLiveRefresh({ onRefresh: refreshAffiliates });

  useEffect(() => {
    function openApplication() {
      startAdd();
      window.requestAnimationFrame(() => {
        document.getElementById("new-affiliate")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    function openApplicationFromHash() {
      if (window.location.hash === "#new-affiliate") openApplication();
    }

    openApplicationFromHash();
    window.addEventListener("hashchange", openApplicationFromHash);
    window.addEventListener(openApplicationEvent, openApplication);
    return () => {
      window.removeEventListener("hashchange", openApplicationFromHash);
      window.removeEventListener(openApplicationEvent, openApplication);
    };
  }, []);

  async function loadAffiliateDetail(affiliateId: string, force = false) {
    if (!force && details[affiliateId]) return;
    setDetailLoadingId(affiliateId);
    try {
      const response = await fetch(`/api/affiliates?affiliateId=${encodeURIComponent(affiliateId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load affiliate details");
      setDetails((current) => ({ ...current, [affiliateId]: data.detail }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load affiliate details");
    } finally {
      setDetailLoadingId((current) => current === affiliateId ? null : current);
    }
  }

  function toggleDetails(affiliateId: string) {
    if (expandedId === affiliateId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(affiliateId);
    void loadAffiliateDetail(affiliateId);
  }

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
    document.getElementById("new-affiliate")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      if (!response.ok) throw new Error(data.error || "Could not save affiliate");

      setAffiliates((current) => editingId
        ? current.map((affiliate) => affiliate.id === editingId ? data.affiliate : affiliate)
        : [data.affiliate, ...current]);
      if (editingId && expandedId === editingId) await loadAffiliateDetail(editingId, true);
      resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save affiliate");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(affiliate: Affiliate, status: "active" | "paused", action: string) {
    const key = `${action}:${affiliate.id}`;
    setBusyKey(key);
    setError("");
    try {
      const response = await fetch("/api/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateId: affiliate.id, status })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Could not ${action} affiliate`);
      setAffiliates((current) => current.map((item) => item.id === affiliate.id ? data.affiliate : item));
      if (expandedId === affiliate.id) await loadAffiliateDetail(affiliate.id, true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${action} affiliate`);
    } finally {
      setBusyKey(null);
    }
  }

  async function declineAffiliate(affiliate: Affiliate) {
    const reason = declineReason.trim();
    if (!reason) {
      setError("Enter a decline reason before confirming.");
      return;
    }
    const key = `decline:${affiliate.id}`;
    setBusyKey(key);
    setError("");
    try {
      const response = await fetch(`/api/affiliates?affiliateId=${encodeURIComponent(affiliate.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not decline affiliate");
      await refreshAffiliates();
      setDecliningId(null);
      setDeclineReason("");
      if (expandedId === affiliate.id) setExpandedId(null);
      if (editingId === affiliate.id) resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not decline affiliate");
    } finally {
      setBusyKey(null);
    }
  }

  async function recordPayout(affiliate: Affiliate) {
    const payoutDueCents = affiliate.payoutDueCents ?? 0;
    if (payoutDueCents <= 0) {
      setError(`${affiliate.name} has no payout due.`);
      return;
    }
    if (!window.confirm(`Record the full ${formatCurrencyOrNA(payoutDueCents)} payout for ${affiliate.name}?`)) return;

    const key = `payout:${affiliate.id}`;
    setBusyKey(key);
    setError("");
    try {
      const response = await fetch("/api/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateId: affiliate.id, action: "mark-paid-full" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not record payout");
      setAffiliates((current) => current.map((item) => item.id === affiliate.id ? data.affiliate : item));
      if (expandedId === affiliate.id) await loadAffiliateDetail(affiliate.id, true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record payout");
    } finally {
      setBusyKey(null);
    }
  }

  async function copyCode(affiliate: Affiliate) {
    try {
      await navigator.clipboard.writeText(affiliate.code);
      setCopiedId(affiliate.id);
      window.setTimeout(() => setCopiedId((current) => current === affiliate.id ? null : current), 1600);
    } catch {
      setError("The code could not be copied. Select it manually instead.");
    }
  }

  function directoryActions(affiliate: Affiliate, compact = false) {
    const busy = busyKey?.endsWith(`:${affiliate.id}`) ?? false;
    if (affiliate.status === "declined") {
      return (
        <Button type="button" variant="secondary" className={compact ? "h-8 w-full px-2 col-span-2" : "h-8 px-2"} onClick={() => copyCode(affiliate)} title="Copy released affiliate code">
          {copiedId === affiliate.id ? <Check size={14} /> : <Clipboard size={14} />}
          {compact ? "Copy released code" : null}
        </Button>
      );
    }
    return (
      <div className={compact ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
        <Button type="button" variant="secondary" className={compact ? "h-8 w-full px-2" : "h-8 px-2"} onClick={() => editAffiliate(affiliate)} disabled={busy} title="Edit affiliate">
          <Edit3 size={14} />
          {compact ? "Edit" : null}
        </Button>
        {affiliate.status === "active" ? (
          <Button type="button" variant="secondary" className={compact ? "h-8 w-full px-2" : "h-8 px-2"} onClick={() => updateStatus(affiliate, "paused", "pause")} disabled={busy} title="Pause affiliate">
            <Pause size={14} />
            {compact ? "Pause" : null}
          </Button>
        ) : (
          <Button type="button" variant="secondary" className={compact ? "h-8 w-full px-2" : "h-8 px-2"} onClick={() => updateStatus(affiliate, "active", "resume")} disabled={busy} title="Resume affiliate">
            <Play size={14} />
            {compact ? "Resume" : null}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div id="affiliates-workbench" className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard title="Pending approvals" value={String(metrics.pending)} detail="Codes waiting for review" icon={UserCheck} tone={metrics.pending > 0 ? "amber" : "slate"} />
        <MetricCard title="Active affiliates" value={String(metrics.active)} detail="Partners approved to refer" icon={Users} tone="green" />
        <MetricCard title="Attributed sales" value={formatCurrencyOrNA(metrics.revenue)} detail="Revenue tied to affiliate codes" icon={BadgeDollarSign} tone="blue" />
        <MetricCard title="Payout due" value={formatCurrencyOrNA(metrics.payoutDue)} detail="Outstanding recorded commission" icon={WalletCards} tone={metrics.payoutDue > 0 ? "amber" : "slate"} />
      </section>

      <section className="overflow-hidden rounded-lg border border-amber-200/80 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-amber-100 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-950">Pending approvals</h2>
              <Badge tone={pendingAffiliates.length > 0 ? "amber" : "slate"}>{pendingAffiliates.length}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Review new partner names, codes, rates, and notes before activation.</p>
          </div>
          <Button type="button" onClick={startAdd} className="w-full sm:w-auto">
            <Plus size={16} />
            New application
          </Button>
        </div>

        <div className="p-4">
          {pendingAffiliates.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {pendingAffiliates.map((affiliate) => {
                const busy = busyKey?.endsWith(`:${affiliate.id}`) ?? false;
                return (
                  <div key={affiliate.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-950">{affiliate.name}</span>
                          <Badge tone="amber">Pending</Badge>
                        </div>
                        <button type="button" onClick={() => copyCode(affiliate)} className="mt-2 inline-flex items-center gap-2 font-mono text-sm font-semibold text-blue-700 hover:text-blue-900" title="Copy affiliate code">
                          {copiedId === affiliate.id ? <Check size={14} /> : <Clipboard size={14} />}
                          {affiliate.code}
                        </button>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-slate-500">Proposed rate</div>
                        <div className="font-semibold text-slate-950">{formatPercentOrNA(affiliate.payoutRatePercent)}</div>
                      </div>
                    </div>
                    {affiliate.notes && affiliate.notes !== "N/A" ? <p className="mt-3 text-sm leading-6 text-slate-600">{affiliate.notes}</p> : null}
                    {decliningId === affiliate.id ? (
                      <div className="mt-4 space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
                        <label>
                          <span className="text-xs font-semibold uppercase text-red-700">Decline reason</span>
                          <Input autoFocus maxLength={500} className="mt-1 bg-white" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Why was this application declined?" />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="ghost" className="w-full bg-red-600 text-white hover:bg-red-700 hover:text-white" onClick={() => declineAffiliate(affiliate)} disabled={busy || !declineReason.trim()}>
                            <X size={15} />
                            Confirm decline
                          </Button>
                          <Button type="button" variant="secondary" className="w-full" onClick={() => { setDecliningId(null); setDeclineReason(""); }} disabled={busy}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <Button type="button" className="h-9 w-full px-2" onClick={() => updateStatus(affiliate, "active", "approve")} disabled={busy}>
                          <Check size={15} />
                          Approve
                        </Button>
                        <Button type="button" variant="secondary" className="h-9 w-full px-2" onClick={() => editAffiliate(affiliate)} disabled={busy}>
                          <Edit3 size={15} />
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" className="h-9 w-full px-2 text-red-600 hover:text-red-700" onClick={() => { setDecliningId(affiliate.id); setDeclineReason(""); setError(""); }} disabled={busy}>
                          <X size={15} />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <UserCheck className="mx-auto text-slate-400" size={24} />
              <div className="mt-2 font-semibold text-slate-900">No applications waiting</div>
              <p className="mt-1 text-sm text-slate-500">New affiliate applications will appear here for approval.</p>
            </div>
          )}
        </div>
      </section>

      <div id="new-affiliate" className="scroll-mt-5">
        {showForm ? (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{editingId ? "Edit affiliate" : "New affiliate application"}</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{editingId ? "Update the partner record without changing its current approval status." : "New applications start Pending and appear in the approval queue."}</p>
              </div>
              <Badge tone={form.status === "pending" ? "amber" : statusTone(form.status)}>{statusLabel(form.status)}</Badge>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveAffiliate} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <label className="xl:col-span-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">Affiliate name</span>
                  <Input required className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Partner or company" />
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Affiliate code</span>
                  <Input required minLength={3} maxLength={32} pattern="[A-Z0-9_-]{3,32}" className="mt-1 font-mono uppercase" value={form.code} onChange={(event) => setForm({ ...form, code: cleanCode(event.target.value) })} placeholder="PARTNER20" />
                </label>
                <label>
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">Affiliate type <Badge tone="slate">Planned</Badge></span>
                  <select disabled className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500">
                    <option>Online / Wholesale / Influencer</option>
                  </select>
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-slate-500">Commission rate</span>
                  <Input type="number" min="0" max="100" step="0.01" required disabled={(editingAffiliate?.referredOrders ?? 0) > 0} className="mt-1" value={form.payoutRate} onChange={(event) => setForm({ ...form, payoutRate: event.target.value })} placeholder="20" />
                  {(editingAffiliate?.referredOrders ?? 0) > 0 ? <span className="mt-1 block text-xs text-slate-500">Locked after the first attributed order.</span> : null}
                </label>
                <div className="hidden xl:block" />
                <label className="md:col-span-2 xl:col-span-6">
                  <span className="text-xs font-semibold uppercase text-slate-500">Notes</span>
                  <Input className="mt-1" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Partner context, terms, or follow-up notes" />
                </label>
                <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row xl:col-span-6">
                  <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                    <Save size={16} />
                    {isSaving ? "Saving..." : editingId ? "Save affiliate" : "Create pending application"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetForm} className="w-full sm:w-auto">
                    <X size={16} />
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div> : null}

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Planned capabilities</CardTitle>
              <Badge tone="slate">Planned</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">These are visible for the next release but are disabled because the current database cannot save them yet.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Affiliate type", "Online, Wholesale, and Influencer"],
              ["Contact profile", "Email, phone, and social handle"],
              ["Commission ledger", "Permanent per-order rate snapshots"],
              ["Advanced payouts", "Partial payments, methods, voids, and history"],
              ["Affiliate credit", "Negative balances after reversals"]
            ].map(([title, detail]) => (
              <div key={title} className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 opacity-75">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{title}</span>
                  <Badge tone="slate">Planned</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Partner directory</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Manage active and paused partners, review declined applications, and track referral performance.</p>
          </div>
          <Badge tone="slate">{directoryAffiliates.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end">
            <label>
              <span className="text-xs font-semibold uppercase text-slate-500">Search partners</span>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input className="bg-white pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code, or note" />
              </div>
            </label>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Status</div>
              <div className="mt-1 grid grid-cols-4 rounded-md bg-slate-200/70 p-1">
                {(["all", "active", "paused", "declined"] as const).map((status) => (
                  <button key={status} type="button" className={`rounded px-3 py-1.5 text-xs font-semibold capitalize ${statusFilter === status ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} onClick={() => setStatusFilter(status)}>
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {directoryAffiliates.map((affiliate) => {
              const expanded = expandedId === affiliate.id;
              const busy = busyKey?.endsWith(`:${affiliate.id}`) ?? false;
              return (
                <div key={affiliate.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                  <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => toggleDetails(affiliate.id)} aria-expanded={expanded}>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950">{affiliate.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-700">{affiliate.code}</span>
                        <Badge tone={statusTone(affiliate.status)}>{statusLabel(affiliate.status)}</Badge>
                      </div>
                    </div>
                    {expanded ? <ChevronUp size={18} className="shrink-0 text-slate-500" /> : <ChevronDown size={18} className="shrink-0 text-slate-500" />}
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Attributed sales</div><div className="font-semibold text-slate-950">{formatCurrencyOrNA(affiliate.revenueGeneratedCents)}</div></div>
                    <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">Payout due</div><div className="font-semibold text-slate-950">{formatCurrencyOrNA(affiliate.payoutDueCents)}</div></div>
                  </div>
                  <div className="mt-3">{directoryActions(affiliate, true)}</div>
                  {expanded ? (
                    <div className="mt-3">
                      <AffiliateDetails affiliate={affiliate} detail={details[affiliate.id]} loading={detailLoadingId === affiliate.id} copied={copiedId === affiliate.id} busy={busy} onCopy={() => copyCode(affiliate)} onEdit={() => editAffiliate(affiliate)} onPayout={() => recordPayout(affiliate)} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <DataTable className="hidden md:block" columns={["Affiliate", "Code", "Status", "Sales", "Orders", "Rate", "Payout due", "Actions"]}>
            {directoryAffiliates.map((affiliate) => {
              const expanded = expandedId === affiliate.id;
              const busy = busyKey?.endsWith(`:${affiliate.id}`) ?? false;
              return (
                <Fragment key={affiliate.id}>
                  <tr>
                    <Td>
                      <button type="button" className="inline-flex items-center gap-2 font-semibold text-slate-950 hover:text-blue-700" onClick={() => toggleDetails(affiliate.id)} aria-expanded={expanded}>
                        {affiliate.name}
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </Td>
                    <Td>
                      <button type="button" onClick={() => copyCode(affiliate)} className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-blue-700 hover:text-blue-900" title="Copy affiliate code">
                        {copiedId === affiliate.id ? <Check size={13} /> : <Clipboard size={13} />}
                        {affiliate.code}
                      </button>
                    </Td>
                    <Td><Badge tone={statusTone(affiliate.status)}>{statusLabel(affiliate.status)}</Badge></Td>
                    <Td>{formatCurrencyOrNA(affiliate.revenueGeneratedCents)}</Td>
                    <Td>{formatNumberOrNA(affiliate.referredOrders)}</Td>
                    <Td>{formatPercentOrNA(affiliate.payoutRatePercent)}</Td>
                    <Td className="font-medium text-slate-950">{formatCurrencyOrNA(affiliate.payoutDueCents)}</Td>
                    <Td>{directoryActions(affiliate)}</Td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-white hover:bg-white">
                      <Td colSpan={8} className="p-3">
                        <AffiliateDetails affiliate={affiliate} detail={details[affiliate.id]} loading={detailLoadingId === affiliate.id} copied={copiedId === affiliate.id} busy={busy} onCopy={() => copyCode(affiliate)} onEdit={() => editAffiliate(affiliate)} onPayout={() => recordPayout(affiliate)} />
                      </Td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </DataTable>

          {directoryAffiliates.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <Users className="mx-auto text-slate-400" size={24} />
              <div className="mt-2 font-semibold text-slate-900">No partners match these filters</div>
              <p className="mt-1 text-sm text-slate-500">Approve an application or adjust the search and filters.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
