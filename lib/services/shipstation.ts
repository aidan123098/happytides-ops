import type { ShippingAddress, ShippingRate } from "@/types/domain";

const shipStationBaseUrl = "https://api.shipstation.com/v2";
const requestTimeoutMs = 15_000;

type JsonObject = Record<string, unknown>;

export type ShipStationWarehouse = {
  id: string;
  name: string;
};

export type ShipStationCarrier = {
  id: string;
  code: string;
  name: string;
};

export type ShipStationParcel = {
  packageCode: string;
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
};

export type ShipStationLabel = {
  labelId: string;
  shipmentId?: string;
  rateId?: string;
  carrierId?: string;
  carrierCode?: string;
  serviceCode?: string;
  serviceName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  trackingStatus?: string;
  labelDownloadUrl?: string;
  costCents?: number;
  currency: string;
  estimatedDeliveryAt?: string;
};

export class ShipStationError extends Error {
  status?: number;
  providerPath?: string;
  retryable: boolean;
  ambiguous: boolean;

  constructor(message: string, options: { status?: number; providerPath?: string; retryable?: boolean; ambiguous?: boolean } = {}) {
    super(message);
    this.name = "ShipStationError";
    this.status = options.status;
    this.providerPath = options.providerPath;
    this.retryable = options.retryable ?? false;
    this.ambiguous = options.ambiguous ?? false;
  }
}

function objectValue(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function moneyCents(value: unknown) {
  const amount = numberValue(objectValue(value).amount ?? value);
  return amount === undefined ? 0 : Math.round(amount * 100);
}

function errorMessage(payload: unknown, fallback: string) {
  const data = objectValue(payload);
  const errors = arrayValue(data.errors);
  const firstError = objectValue(errors[0]);
  return stringValue(firstError.message, firstError.error_message, data.message, data.error, fallback) ?? fallback;
}

function rateFailureMessages(response: JsonObject) {
  const messages: string[] = [];
  for (const entry of arrayValue(response.errors)) {
    const error = objectValue(entry);
    const message = stringValue(error.message, error.error_message);
    if (message) messages.push(message);
  }
  for (const entry of arrayValue(response.invalid_rates)) {
    const rate = objectValue(entry);
    const carrier = stringValue(rate.carrier_friendly_name, rate.carrier_nickname, rate.carrier_code);
    const service = stringValue(rate.service_type, rate.service_name, rate.service_code);
    const source = [carrier, service].filter(Boolean).join(" ");
    for (const value of arrayValue(rate.error_messages)) {
      if (typeof value === "string" && value.trim()) messages.push(source ? `${source}: ${value}` : value);
    }
  }
  return [...new Set(messages)].slice(0, 6);
}

async function shipStationRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim();
  if (!apiKey) {
    throw new ShipStationError("ShipStation is not connected. Add SHIPSTATION_API_KEY before enabling shipping.", {
      providerPath: `/v2${path}`
    });
  }

  let response: Response;
  try {
    response = await fetch(`${shipStationBaseUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: {
        Accept: "application/json",
        "API-Key": apiKey,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers
      }
    });
  } catch (error) {
    throw new ShipStationError(error instanceof Error ? error.message : "ShipStation did not respond.", {
      providerPath: `/v2${path}`,
      retryable: true,
      ambiguous: init.method === "POST"
    });
  }

  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ShipStationError(errorMessage(payload, `ShipStation request failed (${response.status}).`), {
      status: response.status,
      providerPath: `/v2${path}`,
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      ambiguous: false
    });
  }

  return payload as T;
}

function addressToProvider(address: ShippingAddress) {
  return {
    name: address.recipientName,
    company_name: address.company || undefined,
    phone: address.phone || undefined,
    email: address.email || undefined,
    address_line1: address.line1,
    address_line2: address.line2 || undefined,
    city_locality: address.city,
    state_province: address.region,
    postal_code: address.postalCode,
    country_code: "US",
    address_residential_indicator: address.residential ? "yes" : "no"
  };
}

function providerToAddress(value: unknown, fallback: ShippingAddress): ShippingAddress {
  const address = objectValue(value);
  return {
    recipientName: stringValue(address.name, fallback.recipientName) ?? fallback.recipientName,
    company: stringValue(address.company_name, fallback.company),
    line1: stringValue(address.address_line1, fallback.line1) ?? fallback.line1,
    line2: stringValue(address.address_line2, fallback.line2),
    city: stringValue(address.city_locality, fallback.city) ?? fallback.city,
    region: stringValue(address.state_province, fallback.region) ?? fallback.region,
    postalCode: stringValue(address.postal_code, fallback.postalCode) ?? fallback.postalCode,
    country: "US",
    phone: stringValue(address.phone, fallback.phone),
    email: stringValue(address.email, fallback.email),
    residential: address.address_residential_indicator === "no" ? false : fallback.residential
  };
}

export function isShipStationConfigured() {
  return Boolean(process.env.SHIPSTATION_API_KEY?.trim());
}

export async function testShipStationConnection() {
  await shipStationRequest("/carriers?page_size=1");
  return true;
}

export async function listShipStationWarehouses(): Promise<ShipStationWarehouse[]> {
  const payload = objectValue(await shipStationRequest<unknown>("/warehouses?page_size=100"));
  return arrayValue(payload.warehouses).map((entry) => {
    const warehouse = objectValue(entry);
    return {
      id: stringValue(warehouse.warehouse_id, warehouse.id) ?? "",
      name: stringValue(warehouse.name, warehouse.warehouse_name) ?? "Unnamed warehouse"
    };
  }).filter((warehouse) => warehouse.id);
}

export async function listShipStationCarriers(): Promise<ShipStationCarrier[]> {
  const payload = objectValue(await shipStationRequest<unknown>("/carriers?page_size=100"));
  return arrayValue(payload.carriers).map((entry) => {
    const carrier = objectValue(entry);
    return {
      id: stringValue(carrier.carrier_id, carrier.id) ?? "",
      code: stringValue(carrier.carrier_code, carrier.code) ?? "",
      name: stringValue(carrier.friendly_name, carrier.name, carrier.nickname, carrier.carrier_code) ?? "Carrier"
    };
  }).filter((carrier) => carrier.id);
}

export async function ensureShipStationTrackingWebhook(url: string, secret: string) {
  const raw = await shipStationRequest<unknown>("/environment/webhooks");
  const entries = Array.isArray(raw) ? raw : arrayValue(objectValue(raw).webhooks);
  const webhooks = entries.map((entry) => objectValue(entry));
  const exact = webhooks.find((webhook) => stringValue(webhook.event) === "track" && stringValue(webhook.url) === url);
  const otherTrackingWebhook = webhooks.find((webhook) => stringValue(webhook.event) === "track" && stringValue(webhook.url) !== url);
  if (otherTrackingWebhook && !exact) {
    throw new ShipStationError("A different tracking webhook is already registered in ShipStation. Update or remove it before enabling HappyTides shipping.");
  }

  const body = {
    name: "HappyTides tracking",
    event: "track",
    url,
    headers: [{ key: "x-happytides-webhook-secret", value: secret }]
  };
  const webhookId = exact ? stringValue(exact.webhook_id, exact.id) : undefined;
  if (webhookId) {
    await shipStationRequest(`/environment/webhooks/${encodeURIComponent(webhookId)}`, { method: "PUT", body: JSON.stringify(body) });
    return webhookId;
  }
  const created = objectValue(await shipStationRequest<unknown>("/environment/webhooks", { method: "POST", body: JSON.stringify(body) }));
  return stringValue(created.webhook_id, created.id);
}

export async function getShipStationRates(input: {
  externalShipmentId: string;
  warehouseId: string;
  carrierIds: string[];
  address: ShippingAddress;
  parcel: ShipStationParcel;
}) {
  const payload = objectValue(await shipStationRequest<unknown>("/rates", {
    method: "POST",
    body: JSON.stringify({
      rate_options: { carrier_ids: input.carrierIds },
      shipment: {
        external_shipment_id: input.externalShipmentId,
        warehouse_id: input.warehouseId,
        validate_address: "validate_and_clean",
        ship_to: addressToProvider(input.address),
        packages: [{
          package_code: input.parcel.packageCode,
          weight: { value: input.parcel.weightOz, unit: "ounce" },
          dimensions: {
            unit: "inch",
            length: input.parcel.lengthIn,
            width: input.parcel.widthIn,
            height: input.parcel.heightIn
          }
        }]
      }
    })
  }));
  const response = objectValue(payload.rate_response);
  const rates = arrayValue(response.rates ?? payload.rates).map((entry): ShippingRate | undefined => {
    const rate = objectValue(entry);
    const id = stringValue(rate.rate_id, rate.id);
    if (!id) return undefined;
    const amountCents = [rate.shipping_amount, rate.insurance_amount, rate.confirmation_amount, rate.other_amount]
      .reduce<number>((total, amount) => total + moneyCents(amount), 0);
    const deliveryDays = numberValue(rate.delivery_days);
    return {
      id,
      carrierId: stringValue(rate.carrier_id) ?? "",
      carrierCode: stringValue(rate.carrier_code) ?? "",
      carrierName: stringValue(rate.carrier_friendly_name, rate.carrier_nickname, rate.carrier_code) ?? "Carrier",
      serviceCode: stringValue(rate.service_code) ?? "",
      serviceName: stringValue(rate.service_type, rate.service_name, rate.service_code) ?? "Service",
      amountCents,
      currency: stringValue(objectValue(rate.shipping_amount).currency, rate.currency) ?? "usd",
      deliveryDays,
      estimatedDeliveryAt: stringValue(rate.estimated_delivery_date)
    };
  }).filter((rate): rate is ShippingRate => Boolean(rate));

  if (!rates.length) {
    const details = rateFailureMessages(response);
    throw new ShipStationError(`No connected carrier returned a rate.${details.length ? ` ${details.join(" ")}` : ""}`, {
      status: 200,
      providerPath: "/v2/rates"
    });
  }

  return {
    shipmentId: stringValue(payload.shipment_id, response.shipment_id),
    correctedAddress: providerToAddress(payload.ship_to ?? objectValue(payload.shipment).ship_to, input.address),
    rates
  };
}

function normalizeLabel(payload: unknown): ShipStationLabel {
  const label = objectValue(payload);
  const download = objectValue(label.label_download);
  const cost = label.shipment_cost ?? label.cost;
  return {
    labelId: stringValue(label.label_id, label.id) ?? "",
    shipmentId: stringValue(label.shipment_id),
    rateId: stringValue(label.rate_id),
    carrierId: stringValue(label.carrier_id),
    carrierCode: stringValue(label.carrier_code),
    serviceCode: stringValue(label.service_code),
    serviceName: stringValue(label.service_type, label.service_name),
    trackingNumber: stringValue(label.tracking_number),
    trackingUrl: stringValue(label.tracking_url),
    trackingStatus: stringValue(label.tracking_status, objectValue(label.tracking_status).status_code),
    labelDownloadUrl: stringValue(download.pdf, download.href, label.label_download_url),
    costCents: cost === undefined ? undefined : moneyCents(cost),
    currency: stringValue(objectValue(cost).currency, label.currency) ?? "usd",
    estimatedDeliveryAt: stringValue(label.estimated_delivery_date)
  };
}

export async function purchaseShipStationLabel(rateId: string) {
  const payload = await shipStationRequest<unknown>(`/labels/rates/${encodeURIComponent(rateId)}`, {
    method: "POST",
    body: JSON.stringify({
      label_format: "pdf",
      label_layout: "4x6",
      label_download_type: "url"
    })
  });
  const label = normalizeLabel(payload);
  if (!label.labelId) throw new ShipStationError("ShipStation purchased postage but did not return a label ID.", { ambiguous: true });
  return label;
}

export async function getShipStationLabel(labelId: string) {
  return normalizeLabel(await shipStationRequest<unknown>(`/labels/${encodeURIComponent(labelId)}`));
}

export async function findShipStationLabel(externalShipmentId: string) {
  const payload = objectValue(await shipStationRequest<unknown>(`/labels?external_shipment_id=${encodeURIComponent(externalShipmentId)}&page_size=10`));
  const labels = arrayValue(payload.labels).map(normalizeLabel).filter((label) => label.labelId);
  return labels[0];
}

export async function voidShipStationLabel(labelId: string) {
  const payload = objectValue(await shipStationRequest<unknown>(`/labels/${encodeURIComponent(labelId)}/void`, { method: "PUT" }));
  return {
    approved: payload.approved !== false,
    message: stringValue(payload.message)
  };
}

export async function downloadShipStationLabel(downloadUrl: string) {
  const url = new URL(downloadUrl);
  const allowedHost = url.protocol === "https:" && (
    url.hostname === "api.shipstation.com"
    || url.hostname.endsWith(".shipstation.com")
    || url.hostname === "api.shipengine.com"
    || url.hostname.endsWith(".shipengine.com")
  );
  if (!allowedHost) throw new ShipStationError("ShipStation returned an invalid label download URL.");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
    headers: process.env.SHIPSTATION_API_KEY ? { "API-Key": process.env.SHIPSTATION_API_KEY } : undefined
  });
  if (!response.ok) throw new ShipStationError("The label PDF could not be downloaded from ShipStation.", { status: response.status });
  return response.arrayBuffer();
}

export async function getShipStationWebhookResource(resourceUrl: string) {
  const url = new URL(resourceUrl);
  const allowedHost = url.protocol === "https:" && (
    url.hostname === "api.shipstation.com"
    || url.hostname === "api.shipengine.com"
  );
  if (!allowedHost) throw new ShipStationError("ShipStation sent an invalid webhook resource URL.");
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim();
  if (!apiKey) throw new ShipStationError("ShipStation is not connected.");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
    headers: { Accept: "application/json", "API-Key": apiKey }
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new ShipStationError(errorMessage(payload, "ShipStation tracking details could not be loaded."), { status: response.status });
  return payload;
}
