"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Clipboard, ExternalLink, MapPin, PackageCheck, Printer, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { emptyShippingAddress, ShippingAddressFields } from "@/components/shipping-address-fields";
import { canPurchaseShippingLabel, isShippingAddressComplete } from "@/lib/shipping-policy";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { formatCurrency } from "@/lib/utils";
import type { Order, ShippingAddress, ShippingConfig, ShippingRate } from "@/types/domain";

type ShippingWorkbenchProps = {
  initialOrders: Order[];
  initialConfig: ShippingConfig;
};

type Quote = {
  shipmentId: string;
  originalAddress: ShippingAddress;
  correctedAddress: ShippingAddress;
  addressCorrected: boolean;
  addressMessages: string[];
  parcel: Parcel;
  rates: ShippingRate[];
};

type Parcel = {
  packageCode: string;
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
};

type QueueState = {
  label: string;
  tone: "blue" | "green" | "amber" | "red" | "cyan" | "slate";
};

function queueState(order: Order): QueueState {
  const label = order.shippingLabel;
  if (label?.status === "exception" || label?.status === "error" || label?.status === "reconciling") return { label: "Exception", tone: "red" };
  if (label?.status === "delivered" || order.status === "delivered") return { label: "Delivered", tone: "green" };
  if (label?.status === "in_transit" || order.status === "shipped") return { label: "In transit", tone: "cyan" };
  if (label?.status === "completed" || label?.status === "purchasing") return { label: "Label created", tone: "blue" };
  if (!order.shippingAddress) return { label: "Address needed", tone: "amber" };
  if (order.status === "unfulfilled") return { label: "Waiting for payment", tone: "slate" };
  if (canPurchaseShippingLabel(order.status)) return { label: "Ready for label", tone: "green" };
  return { label: "Waiting", tone: "slate" };
}

function parcelFromConfig(config: ShippingConfig): Parcel {
  return {
    packageCode: config.defaultPackageCode || "package",
    weightOz: config.defaultWeightOz ?? 0,
    lengthIn: config.defaultLengthIn ?? 0,
    widthIn: config.defaultWidthIn ?? 0,
    heightIn: config.defaultHeightIn ?? 0
  };
}

function displayAddress(address?: ShippingAddress) {
  if (!address) return "No shipping address";
  return `${address.line1}${address.line2 ? `, ${address.line2}` : ""}, ${address.city}, ${address.region} ${address.postalCode}`;
}

function deliveryText(rate: ShippingRate) {
  if (rate.estimatedDeliveryAt) {
    const date = new Date(rate.estimatedDeliveryAt);
    if (!Number.isNaN(date.getTime())) return `Est. ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return rate.deliveryDays ? `${rate.deliveryDays} business day${rate.deliveryDays === 1 ? "" : "s"}` : "Estimate unavailable";
}

export function ShippingWorkbench({ initialOrders, initialConfig }: ShippingWorkbenchProps) {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState(initialOrders);
  const [config, setConfig] = useState(initialConfig);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [addressOrderId, setAddressOrderId] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingAddress>(emptyShippingAddress);
  const [saveDefault, setSaveDefault] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [rateOrderId, setRateOrderId] = useState<string | null>(null);
  const [parcel, setParcel] = useState<Parcel>(() => parcelFromConfig(initialConfig));
  const [quote, setQuote] = useState<Quote | null>(null);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [loadingRates, setLoadingRates] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "green" | "amber" | "red"; text: string } | null>(null);

  async function refreshQueue() {
    const response = await fetch("/api/shipping", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json().catch(() => null);
    if (Array.isArray(payload?.orders)) setOrders(payload.orders);
    if (payload?.config) setConfig(payload.config);
  }

  useLiveRefresh({ onRefresh: refreshQueue });

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId) return;
    const order = initialOrders.find((candidate) => candidate.id === orderId);
    if (!order) return;
    window.setTimeout(() => document.getElementById(`shipping-${orderId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, [initialOrders, searchParams]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const state = queueState(order).label.toLowerCase().replaceAll(" ", "_");
    const matchesFilter = filter === "all" || state === filter;
    const haystack = `${order.orderNumber} ${order.customerName} ${order.shippingLabel?.trackingNumber ?? ""} ${order.items.map((item) => item.productName).join(" ")}`.toLowerCase();
    return matchesFilter && (!search || haystack.includes(search.toLowerCase()));
  }), [filter, orders, search]);

  function startAddress(order: Order) {
    setAddressOrderId(order.id);
    setAddress(order.shippingAddress ?? { ...emptyShippingAddress, recipientName: order.customerName });
    setMessage(null);
  }

  async function saveAddress(orderId: string) {
    if (!isShippingAddressComplete(address) || savingAddress) return;
    setSavingAddress(true);
    setMessage({ tone: "amber", text: "Saving shipping address..." });
    try {
      const response = await fetch("/api/shipping/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, address, saveAsCustomerDefault: saveDefault })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.order) {
        setMessage({ tone: "red", text: payload.error ?? "The address could not be saved." });
        return;
      }
      setOrders((current) => current.map((order) => order.id === orderId ? payload.order : order));
      setAddressOrderId(null);
      setMessage({ tone: "green", text: `${payload.order.orderNumber} shipping address saved.` });
    } catch {
      setMessage({ tone: "red", text: "The address could not be saved. Try again in a moment." });
    } finally {
      setSavingAddress(false);
    }
  }

  function startRates(order: Order) {
    setRateOrderId(order.id);
    setParcel(parcelFromConfig(config));
    setQuote(null);
    setSelectedRateId("");
    setMessage(null);
  }

  async function reviewRates(orderId: string) {
    if (loadingRates) return;
    setLoadingRates(true);
    setQuote(null);
    setMessage({ tone: "amber", text: "Validating the address and loading carrier rates..." });
    try {
      const response = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, parcel })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "red", text: payload.error ?? "Rates could not be loaded." });
        return;
      }
      setQuote(payload);
      const firstPurchasableRate = payload.rates.find((rate: ShippingRate) => rate.purchasable && rate.serviceCode !== "ups_ground_saver")
        ?? payload.rates.find((rate: ShippingRate) => rate.purchasable);
      setSelectedRateId(firstPurchasableRate?.id ?? "");
      setMessage(firstPurchasableRate
        ? { tone: "green", text: `${payload.rates.length} live rate${payload.rates.length === 1 ? "" : "s"} loaded. No postage has been purchased.` }
        : { tone: "red", text: "Rates loaded, but none are available for label purchase. Check the carrier services and try again." });
    } catch {
      setMessage({ tone: "red", text: "Rates could not be loaded. Try again in a moment." });
    } finally {
      setLoadingRates(false);
    }
  }

  async function buyLabel() {
    if (!quote || !selectedRateId || purchasing) return;
    const selectedRate = quote.rates.find((rate) => rate.id === selectedRateId);
    if (!selectedRate?.purchasable) {
      setMessage({ tone: "red", text: selectedRate?.purchaseBlockReason ?? "Choose an available shipping rate." });
      return;
    }
    setPurchasing(true);
    setMessage({ tone: "amber", text: "Purchasing one label from ShipStation..." });
    try {
      const response = await fetch("/api/shipping/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: quote.shipmentId, rateId: selectedRateId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "red", text: payload.error ?? "The label could not be purchased." });
        return;
      }
      if (payload.pending) {
        setMessage({ tone: "amber", text: "ShipStation is confirming the purchase. Do not buy another label; refresh in a moment." });
        return;
      }
      await refreshQueue();
      setQuote(null);
      setRateOrderId(null);
      setMessage({ tone: "green", text: "Label purchased. Opening the 4 x 6 PDF." });
      window.open(`/api/shipping/labels/${encodeURIComponent(payload.shipment.id)}/download`, "_blank", "noopener,noreferrer");
    } catch {
      setMessage({ tone: "red", text: "The label request did not finish. The server will reconcile it before another purchase is allowed." });
    } finally {
      setPurchasing(false);
    }
  }

  async function voidLabel(order: Order) {
    const label = order.shippingLabel;
    if (!label || voidingId) return;
    if (!window.confirm(`Void the unused label for ${order.orderNumber}? ShipStation will determine refund eligibility.`)) return;
    setVoidingId(label.id);
    setMessage({ tone: "amber", text: `Voiding ${order.orderNumber} label...` });
    try {
      const response = await fetch(`/api/shipping/labels/${encodeURIComponent(label.id)}/void`, { method: "PUT" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "red", text: payload.error ?? "The label could not be voided." });
        return;
      }
      await refreshQueue();
      setMessage({ tone: "green", text: `${order.orderNumber} label voided.` });
    } catch {
      setMessage({ tone: "red", text: "The label could not be voided. Try again in a moment." });
    } finally {
      setVoidingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {!config.enabled ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <div><span className="font-semibold">Label purchasing is disabled.</span> Configure and test ShipStation in Settings before enabling it.</div>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
          <Badge tone={message.tone}>{message.tone === "green" ? "Ready" : message.tone === "amber" ? "Working" : "Check"}</Badge>
          <span className="ml-2">{message.text}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Shipping queue</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Review addresses, compare live rates, print labels, and follow tracking.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_210px]">
            <Input className="bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, product, tracking" />
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All queue states</option>
              <option value="address_needed">Address needed</option>
              <option value="waiting_for_payment">Waiting for payment</option>
              <option value="ready_for_label">Ready for label</option>
              <option value="label_created">Label created</option>
              <option value="in_transit">In transit</option>
              <option value="delivered">Delivered</option>
              <option value="exception">Exception</option>
            </select>
          </div>

          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {filteredOrders.map((order) => {
              const state = queueState(order);
              const label = order.shippingLabel;
              const canBuy = config.enabled && config.configured && order.shippingAddress && canPurchaseShippingLabel(order.status) && !label;
              return (
                <div id={`shipping-${order.id}`} key={order.id} className="p-3 [content-visibility:auto] [contain-intrinsic-size:180px] sm:p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-950">{order.orderNumber}</span>
                        <Badge tone={state.tone}>{state.label}</Badge>
                        <span className="text-xs font-medium capitalize text-slate-500">{order.status}</span>
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-700">{order.customerName}</div>
                      <div className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                        <MapPin className="mt-0.5 shrink-0" size={13} />
                        <span>{displayAddress(order.shippingAddress)}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}</div>
                      {label?.trackingNumber ? <div className="mt-1 font-mono text-xs text-slate-600">{label.trackingNumber}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {!order.shippingAddress && !label && order.status !== "shipped" && order.status !== "delivered" ? (
                        <Button variant="secondary" onClick={() => startAddress(order)}><MapPin size={15} />Add address</Button>
                      ) : null}
                      {order.shippingAddress && !label && order.status !== "shipped" && order.status !== "delivered" ? (
                        <Button variant="secondary" onClick={() => startAddress(order)}><MapPin size={15} />Edit address</Button>
                      ) : null}
                      {!label ? (
                        <Button onClick={() => startRates(order)} disabled={!canBuy}><PackageCheck size={15} />Review rates</Button>
                      ) : null}
                      {label?.status === "completed" || label?.status === "in_transit" || label?.status === "delivered" || label?.status === "exception" ? (
                        <a className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white" href={`/api/shipping/labels/${encodeURIComponent(label.id)}/download`} target="_blank" rel="noreferrer"><Printer size={15} />Reprint</a>
                      ) : null}
                      {label?.trackingNumber ? (
                        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(label.trackingNumber!)}><Clipboard size={15} />Copy tracking</Button>
                      ) : null}
                      {label?.trackingUrl ? (
                        <a className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900" href={label.trackingUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open tracking</a>
                      ) : null}
                      {label && label.status !== "delivered" ? (
                        <Button variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => voidLabel(order)} disabled={voidingId === label.id}><X size={15} />{voidingId === label.id ? "Voiding..." : "Void label"}</Button>
                      ) : null}
                    </div>
                  </div>

                  {addressOrderId === order.id ? (
                    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <ShippingAddressFields value={address} onChange={setAddress} disabled={savingAddress} />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={saveDefault} onChange={(event) => setSaveDefault(event.target.checked)} />Save as customer default</label>
                        <div className="flex gap-2"><Button variant="ghost" onClick={() => setAddressOrderId(null)}>Cancel</Button><Button onClick={() => saveAddress(order.id)} disabled={savingAddress || !isShippingAddressComplete(address)}>{savingAddress ? "Saving..." : "Save address"}</Button></div>
                      </div>
                    </div>
                  ) : null}

                  {rateOrderId === order.id ? (
                    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-950">Package and rates</div><Button variant="ghost" className="h-8 px-2" onClick={() => { setRateOrderId(null); setQuote(null); }}><X size={15} /></Button></div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <label><span className="text-xs font-semibold uppercase text-slate-500">Weight oz</span><Input className="mt-1 bg-white" type="number" min="0.1" step="0.1" value={parcel.weightOz} onChange={(event) => setParcel({ ...parcel, weightOz: Number(event.target.value) })} /></label>
                        <label><span className="text-xs font-semibold uppercase text-slate-500">Length in</span><Input className="mt-1 bg-white" type="number" min="0.1" step="0.1" value={parcel.lengthIn} onChange={(event) => setParcel({ ...parcel, lengthIn: Number(event.target.value) })} /></label>
                        <label><span className="text-xs font-semibold uppercase text-slate-500">Width in</span><Input className="mt-1 bg-white" type="number" min="0.1" step="0.1" value={parcel.widthIn} onChange={(event) => setParcel({ ...parcel, widthIn: Number(event.target.value) })} /></label>
                        <label><span className="text-xs font-semibold uppercase text-slate-500">Height in</span><Input className="mt-1 bg-white" type="number" min="0.1" step="0.1" value={parcel.heightIn} onChange={(event) => setParcel({ ...parcel, heightIn: Number(event.target.value) })} /></label>
                        <div className="flex items-end"><Button className="w-full" onClick={() => reviewRates(order.id)} disabled={loadingRates || Object.values(parcel).some((value) => typeof value === "number" && value <= 0)}><RefreshCw size={15} />{loadingRates ? "Loading..." : "Get rates"}</Button></div>
                      </div>
                      {quote?.addressCorrected ? (
                        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><div className="flex items-center gap-2 font-semibold"><Check size={15} />ShipStation corrected the address</div><div className="mt-1">{displayAddress(quote.correctedAddress)}</div><div className="mt-1 text-xs">Buying the label confirms this corrected version.</div></div>
                      ) : null}
                      {quote ? (
                        <div className="mt-3 space-y-2">
                          {quote.rates.map((rate) => (
                            <label key={rate.id} className={`flex items-center gap-3 rounded-md border bg-white p-3 ${rate.purchasable ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${selectedRateId === rate.id ? "border-slate-950 ring-1 ring-slate-950" : "border-slate-200"}`}>
                              <input type="radio" name={`rate-${order.id}`} checked={selectedRateId === rate.id} disabled={!rate.purchasable} onChange={() => setSelectedRateId(rate.id)} />
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-slate-950">{rate.carrierName} {rate.serviceName}</span>
                                <span className="block text-xs text-slate-500">{deliveryText(rate)}</span>
                                {rate.serviceCode === "ups_ground_saver" ? <span className="mt-1 block text-xs font-medium text-amber-700">Requires a funded UPS from ShipStation balance.</span> : null}
                                {!rate.purchasable ? <span className="mt-1 block text-xs font-medium text-amber-700">{rate.purchaseBlockReason}</span> : null}
                              </span>
                              <span className="font-semibold text-slate-950">{formatCurrency(rate.amountCents)}</span>
                            </label>
                          ))}
                          <div className="flex justify-end pt-1"><Button onClick={buyLabel} disabled={!selectedRateId || purchasing || !quote.rates.find((rate) => rate.id === selectedRateId)?.purchasable}><Printer size={15} />{purchasing ? "Buying..." : "Buy & Print"}</Button></div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {filteredOrders.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No shipping orders match this view.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
