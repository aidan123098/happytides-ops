import crypto from "crypto";
import { prisma } from "@/lib/prisma";

type SquareWebhookResult = {
  eventId: string;
  eventType: string;
  duplicate: boolean;
  accepted: boolean;
};

export function getSquareConfig() {
  return {
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENVIRONMENT ?? "sandbox",
    locationId: process.env.SQUARE_LOCATION_ID,
    webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  };
}

export function squareConfigured() {
  const config = getSquareConfig();
  return Boolean(config.accessToken && config.locationId);
}

export function verifySquareWebhookSignature(args: {
  body: string;
  signature: string | null;
  notificationUrl: string;
}) {
  const { webhookSignatureKey } = getSquareConfig();

  if (!webhookSignatureKey) {
    return process.env.NODE_ENV !== "production";
  }

  if (!args.signature) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", webhookSignatureKey);
  hmac.update(args.notificationUrl + args.body);
  const expectedSignature = hmac.digest("base64");
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(args.signature);

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

export async function handleSquareWebhook(payload: unknown): Promise<SquareWebhookResult> {
  const event = payload as { event_id?: string; type?: string };
  const eventId = event.event_id ?? `square_event_${crypto.randomUUID()}`;
  const eventType = event.type ?? "unknown";
  const existing = await prisma.squareEvent.findUnique({ where: { squareEventId: eventId } });

  if (existing) {
    return {
      eventId,
      eventType,
      duplicate: true,
      accepted: true
    };
  }

  await prisma.squareEvent.create({
    data: {
      squareEventId: eventId,
      eventType,
      payload: payload as never,
      processedAt: null
    }
  });

  return {
    eventId,
    eventType,
    duplicate: false,
    accepted: true
  };
}

export async function syncSquareData() {
  if (!squareConfigured()) {
    await prisma.squareSyncRun.create({
      data: {
        status: "NOT_CONNECTED",
        finishedAt: new Date(),
        error: "Square access token and location ID are required before sync can run."
      }
    });

    return {
      connected: false,
      error: "Square is not connected. Configure SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to enable sync."
    };
  }

  const run = await prisma.squareSyncRun.create({
    data: {
      status: "NOT_IMPLEMENTED",
      finishedAt: new Date(),
      error: "Square API ingestion is configured but not yet implemented in this build."
    }
  });

  return {
    connected: true,
    runId: run.id,
    error: "Square API ingestion is not yet implemented. No records were imported."
  };
}
