import { NextResponse } from "next/server";
import { invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { processShipStationTrackingWebhook, ShipStationWebhookError, verifyShipStationWebhook } from "@/lib/services/shipstation-webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    await verifyShipStationWebhook(request, rawBody);
    const result = await processShipStationTrackingWebhook(rawBody);
    invalidateOperationalDataCache();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof ShipStationWebhookError ? error.status : 500;
    const message = status === 401 || status === 404 ? "Not found." : error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status });
  }
}
