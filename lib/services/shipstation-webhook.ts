import { createHash, createPublicKey, createVerify, timingSafeEqual, type JsonWebKey } from "crypto";
import { Prisma, ShippingShipmentStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { trackingOrderStage } from "@/lib/shipping-policy";
import { advanceOrderStatus } from "@/lib/services/operations";
import { getShipStationWebhookResource } from "@/lib/services/shipstation";

type JsonObject = Record<string, unknown>;

type Jwks = {
  keys: Array<JsonWebKey & { kid?: string }>;
};

let jwksCache: { value: Jwks; etag?: string; fetchedAt: number } | undefined;

export class ShipStationWebhookError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ShipStationWebhookError";
    this.status = status;
  }
}

function objectValue(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function safeSecretEqual(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function fetchJwks(force = false) {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < 6 * 60 * 60 * 1000) return jwksCache.value;
  const response = await fetch("https://api.shipengine.com/jwks", {
    cache: "no-store",
    headers: jwksCache?.etag ? { "If-None-Match": jwksCache.etag } : undefined,
    signal: AbortSignal.timeout(10_000)
  });
  if (response.status === 304 && jwksCache) {
    jwksCache.fetchedAt = Date.now();
    return jwksCache.value;
  }
  if (!response.ok) throw new ShipStationWebhookError("ShipStation signing keys are temporarily unavailable.", 503);
  const value = await response.json() as Jwks;
  jwksCache = { value, etag: response.headers.get("etag") ?? undefined, fetchedAt: Date.now() };
  return value;
}

export async function verifyShipStationWebhook(request: Request, rawBody: string) {
  const keyId = request.headers.get("x-shipengine-rsa-sha256-key-id");
  const signature = request.headers.get("x-shipengine-rsa-sha256-signature");
  const timestamp = request.headers.get("x-shipengine-timestamp");
  if (!keyId || !signature || !timestamp) throw new ShipStationWebhookError("Not found.", 404);

  const expectedSecret = process.env.SHIPSTATION_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) throw new ShipStationWebhookError("ShipStation webhook verification is not configured.", 503);
  const receivedSecret = request.headers.get("x-happytides-webhook-secret") ?? "";
  if (!safeSecretEqual(receivedSecret, expectedSecret)) throw new ShipStationWebhookError("Invalid webhook signature.", 401);

  const webhookTime = new Date(timestamp).getTime();
  if (!Number.isFinite(webhookTime) || Math.abs(Date.now() - webhookTime) > 5 * 60 * 1000) {
    throw new ShipStationWebhookError("Webhook timestamp is outside the allowed window.", 400);
  }

  let jwks = await fetchJwks();
  let jwk = jwks.keys.find((key) => key.kid === keyId);
  if (!jwk) {
    jwks = await fetchJwks(true);
    jwk = jwks.keys.find((key) => key.kid === keyId);
  }
  if (!jwk) throw new ShipStationWebhookError("Unknown ShipStation signing key.", 401);

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${timestamp}.${rawBody}`, "utf8");
  verifier.end();
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  if (!verifier.verify(publicKey, signature, "base64")) throw new ShipStationWebhookError("Invalid webhook signature.", 401);
}

function labelIdFromPayload(payload: JsonObject, data: JsonObject) {
  const direct = stringValue(data.label_id, payload.label_id);
  if (direct) return direct;
  const labelUrl = stringValue(payload.label_url, data.label_url);
  return labelUrl?.match(/\/labels\/(se-[a-z0-9-]+)/i)?.[1];
}

function eventTime(data: JsonObject) {
  const events = Array.isArray(data.events) ? data.events : [];
  const latest = objectValue(events[0]);
  const value = stringValue(data.occurred_at, data.event_date, latest.occurred_at, latest.event_date);
  const date = value ? new Date(value) : undefined;
  return date && Number.isFinite(date.getTime()) ? date : undefined;
}

export async function processShipStationTrackingWebhook(rawBody: string) {
  const payload = objectValue(JSON.parse(rawBody));
  const resourceUrl = stringValue(payload.resource_url);
  const embeddedData = objectValue(payload.data);
  const fetched = !Object.keys(embeddedData).length && resourceUrl ? objectValue(await getShipStationWebhookResource(resourceUrl)) : {};
  const data = Object.keys(embeddedData).length ? embeddedData : objectValue(fetched.data ?? fetched);
  const trackingNumber = stringValue(data.tracking_number, payload.tracking_number);
  const statusCode = stringValue(data.status_code, data.carrier_status_code, data.status);
  const statusDetail = stringValue(data.status_description, data.status_detail, data.carrier_status_description);
  const labelId = labelIdFromPayload(payload, data);
  const occurredAt = eventTime(data);
  const providerEventKey = createHash("sha256").update(JSON.stringify({ resourceUrl, labelId, trackingNumber, statusCode, statusDetail, occurredAt: occurredAt?.toISOString() })).digest("hex");

  let event = await prisma.shippingEvent.findUnique({ where: { providerEventKey } });
  if (event?.processedAt) return { duplicate: true, matched: Boolean(event.shipmentId) };

  const shipment = await prisma.shippingShipment.findFirst({
    where: {
      OR: [
        ...(labelId ? [{ providerLabelId: labelId }] : []),
        ...(trackingNumber ? [{ trackingNumber }] : [])
      ]
    },
    include: {
      order: true,
      createdBy: { include: { roles: { include: { role: true } } } }
    }
  });

  if (!event) {
    try {
      event = await prisma.shippingEvent.create({
        data: {
          providerEventKey,
          shipmentId: shipment?.id,
          eventType: stringValue(payload.resource_type) ?? "API_TRACK",
          trackingNumber,
          statusCode,
          statusDetail,
          occurredAt
        }
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      event = await prisma.shippingEvent.findUnique({ where: { providerEventKey } });
      if (event?.processedAt) return { duplicate: true, matched: Boolean(event.shipmentId) };
    }
  }
  if (!event) throw new Error("Tracking event could not be recorded.");

  if (!shipment) {
    await prisma.shippingEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    return { duplicate: false, matched: false };
  }

  const normalized = `${statusCode ?? ""} ${statusDetail ?? ""}`.toLowerCase();
  const targetStage = trackingOrderStage(statusCode, statusDetail);
  const exception = normalized.includes("exception") || normalized.includes("failure") || normalized.includes("undeliverable");
  const nextShipmentStatus = targetStage === "delivered"
    ? ShippingShipmentStatus.DELIVERED
    : targetStage === "shipped" && shipment.status !== ShippingShipmentStatus.DELIVERED
      ? ShippingShipmentStatus.IN_TRANSIT
      : exception && shipment.status !== ShippingShipmentStatus.DELIVERED
        ? ShippingShipmentStatus.EXCEPTION
        : shipment.status;

  await prisma.shippingShipment.update({
    where: { id: shipment.id },
    data: {
      status: nextShipmentStatus,
      trackingNumber: trackingNumber ?? shipment.trackingNumber,
      trackingUrl: stringValue(data.tracking_url, data.carrier_tracking_url) ?? shipment.trackingUrl,
      trackingStatus: statusCode ?? shipment.trackingStatus,
      trackingDetail: statusDetail ?? shipment.trackingDetail,
      shippedAt: targetStage === "shipped" ? shipment.shippedAt ?? new Date() : shipment.shippedAt,
      deliveredAt: targetStage === "delivered" ? shipment.deliveredAt ?? new Date() : shipment.deliveredAt
    }
  });

  if (targetStage) {
    await advanceOrderStatus(shipment.orderId, targetStage, {
      id: shipment.createdBy.id,
      name: shipment.createdBy.displayName || shipment.createdBy.name,
      email: shipment.createdBy.email,
      roles: shipment.createdBy.roles.map((entry) => entry.role.name)
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.shippingEvent.update({ where: { id: event!.id }, data: { processedAt: new Date() } });
    await writeAuditLog({
      entityType: "ORDER",
      entityId: shipment.orderId,
      action: "SHIPPING_TRACKING_UPDATED",
      metadata: { shipmentId: shipment.id, statusCode, statusDetail, targetStage }
    }, tx);
  });
  return { duplicate: false, matched: true };
}
