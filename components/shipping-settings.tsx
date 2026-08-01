"use client";

import { useState } from "react";
import { CheckCircle2, PlugZap, Save, Truck, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ShippingConfig } from "@/types/domain";

type WarehouseOption = { id: string; name: string };
type CarrierOption = { id: string; code: string; name: string };

export function ShippingSettings({ initialConfig }: { initialConfig: ShippingConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "green" | "amber" | "red"; text: string } | null>(null);

  async function testConnection() {
    if (testing) return;
    setTesting(true);
    setMessage({ tone: "amber", text: "Testing ShipStation and loading connected warehouses and carriers..." });
    try {
      const response = await fetch("/api/shipping/settings", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "red", text: payload.error ?? "ShipStation connection failed." });
        return;
      }
      setWarehouses(payload.warehouses ?? []);
      setCarriers(payload.carriers ?? []);
      setConfig((current) => ({ ...current, apiConnected: true }));
      setMessage({ tone: "green", text: `Connected. Found ${payload.warehouses.length} warehouse${payload.warehouses.length === 1 ? "" : "s"} and ${payload.carriers.length} carrier account${payload.carriers.length === 1 ? "" : "s"}.` });
    } catch {
      setMessage({ tone: "red", text: "ShipStation connection failed. Try again in a moment." });
    } finally {
      setTesting(false);
    }
  }

  async function saveSettings() {
    if (saving) return;
    setSaving(true);
    setMessage({ tone: "amber", text: "Saving shipping settings..." });
    try {
      const response = await fetch("/api/shipping/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "red", text: payload.error ?? "Shipping settings could not be saved." });
        return;
      }
      setConfig(payload.config);
      setMessage({ tone: "green", text: payload.config.enabled ? "Shipping labels enabled." : "Shipping settings saved with label purchasing disabled." });
    } catch {
      setMessage({ tone: "red", text: "Shipping settings could not be saved. Try again in a moment." });
    } finally {
      setSaving(false);
    }
  }

  function numberField(key: "defaultWeightOz" | "defaultLengthIn" | "defaultWidthIn" | "defaultHeightIn", value: string) {
    setConfig((current) => ({ ...current, [key]: Number(value) }));
  }

  function toggleCarrier(id: string) {
    setConfig((current) => ({
      ...current,
      enabledCarrierIds: current.enabledCarrierIds.includes(id)
        ? current.enabledCarrierIds.filter((carrierId) => carrierId !== id)
        : [...current.enabledCarrierIds, id]
    }));
  }

  const complete = Boolean(config.warehouseId && config.enabledCarrierIds.length && config.defaultWeightOz && config.defaultLengthIn && config.defaultWidthIn && config.defaultHeightIn);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><Truck size={17} className="text-blue-700" /><CardTitle>Shipping and ShipStation</CardTitle></div>
        <Badge tone={config.enabled ? "green" : "slate"}>{config.enabled ? "Enabled" : "Disabled"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">API key</div><div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-950"><PlugZap size={15} />{config.apiConnected ? "Environment key present" : "Not configured"}</div></div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Webhook secret</div><div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-950"><CheckCircle2 size={15} />{config.webhookConfigured ? "Environment secret present" : "Not configured"}</div></div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Label format</div><div className="mt-2 text-sm font-semibold text-slate-950">4 x 6 PDF</div></div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={testConnection} disabled={testing}><PlugZap size={15} />{testing ? "Testing..." : "Test connection"}</Button>
          <p className="text-xs text-slate-500">Secrets stay in local and Vercel environment variables and are never returned to the browser.</p>
        </div>

        <div className="grid gap-4 border-t border-slate-200 pt-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block"><span className="text-xs font-semibold uppercase text-slate-500">Default warehouse</span><select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950" value={config.warehouseId ?? ""} onChange={(event) => setConfig({ ...config, warehouseId: event.target.value })}><option value="">Select warehouse</option>{config.warehouseId && !warehouses.some((item) => item.id === config.warehouseId) ? <option value={config.warehouseId}>Saved warehouse ({config.warehouseId})</option> : null}{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
            <div><div className="text-xs font-semibold uppercase text-slate-500">Enabled carriers</div><div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">{carriers.length ? carriers.map((carrier) => <label key={carrier.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={config.enabledCarrierIds.includes(carrier.id)} onChange={() => toggleCarrier(carrier.id)} />{carrier.name}{carrier.code ? <span className="text-xs text-slate-400">{carrier.code}</span> : null}</label>) : config.enabledCarrierIds.length ? config.enabledCarrierIds.map((id) => <label key={id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700"><input type="checkbox" checked onChange={() => toggleCarrier(id)} />Saved carrier ({id})</label>) : <div className="px-2 py-3 text-sm text-slate-500">Test the connection to load carriers.</div>}</div></div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Warehouse size={16} />Default custom package</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label><span className="text-xs font-semibold uppercase text-slate-500">Weight oz</span><Input className="mt-1" type="number" min="0.1" step="0.1" value={config.defaultWeightOz ?? ""} onChange={(event) => numberField("defaultWeightOz", event.target.value)} /></label>
              <label><span className="text-xs font-semibold uppercase text-slate-500">Length in</span><Input className="mt-1" type="number" min="0.1" step="0.1" value={config.defaultLengthIn ?? ""} onChange={(event) => numberField("defaultLengthIn", event.target.value)} /></label>
              <label><span className="text-xs font-semibold uppercase text-slate-500">Width in</span><Input className="mt-1" type="number" min="0.1" step="0.1" value={config.defaultWidthIn ?? ""} onChange={(event) => numberField("defaultWidthIn", event.target.value)} /></label>
              <label><span className="text-xs font-semibold uppercase text-slate-500">Height in</span><Input className="mt-1" type="number" min="0.1" step="0.1" value={config.defaultHeightIn ?? ""} onChange={(event) => numberField("defaultHeightIn", event.target.value)} /></label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-950"><input type="checkbox" checked={config.enabled} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} />Enable label purchasing</label>
          <Button onClick={saveSettings} disabled={saving || !complete}><Save size={15} />{saving ? "Saving..." : "Save shipping settings"}</Button>
        </div>
        {message ? <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><Badge tone={message.tone}>{message.tone === "green" ? "Connected" : message.tone === "amber" ? "Working" : "Check"}</Badge><span className="ml-2">{message.text}</span></div> : null}
      </CardContent>
    </Card>
  );
}
