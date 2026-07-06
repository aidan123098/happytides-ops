import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { handleSquareWebhook, verifySquareWebhookSignature } from "@/lib/square";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");
  const valid = verifySquareWebhookSignature({
    body,
    signature,
    notificationUrl: request.url
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid Square webhook signature" }, { status: 401 });
  }

  const result = await handleSquareWebhook(JSON.parse(body));

  await writeAuditLog({
    entityType: "SQUARE",
    entityId: result.eventId,
    action: result.duplicate ? "square.webhook.duplicate" : "square.webhook.accepted",
    after: result
  });

  return NextResponse.json(result);
}
