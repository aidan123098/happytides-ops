import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { isDatabaseUnavailable } from "@/lib/offline-store";
import { getOrderById, getOrders, invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { cancelOrder, createOrder, updateOrder } from "@/lib/services/operations";
import { orderInputSchema, orderUpdateSchema } from "@/lib/validation";

function validationError(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error.issues as Array<{ path: Array<string | number>; message: string }>) : [];
  const firstIssue = issues[0];
  const path = firstIssue?.path.length ? `${firstIssue.path.join(".")}: ` : "";
  const detail = firstIssue ? `${path}${firstIssue.message}` : "Check the required fields and try again.";
  return NextResponse.json({ error: detail }, { status: 400 });
}

async function domainOrder(id: string) {
  return getOrderById(id);
}

export async function GET() {
  await requirePermission("orders:read");
  const orders = (await getOrders()).filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled");
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const actor = await requirePermission("orders:create");
  const parsed = orderInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;

  try {
    const order = await createOrder(payload, actor, request);
    invalidateOperationalDataCache();
    return NextResponse.json({ order: { id: order.id, orderNumber: order.orderNumber, totalCents: order.totalCents } }, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "The shared database is unavailable, so the order was not saved. Try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order could not be recorded." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const actor = await requirePermission("orders:manage");
  const parsed = orderUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;

  try {
    const order = await updateOrder(payload.orderId, payload, actor, request);
    invalidateOperationalDataCache();
    return NextResponse.json({ order: await domainOrder(order.id) });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "The shared database is unavailable, so the order was not updated. Try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order could not be updated." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const actor = await requirePermission("orders:cancel");
  const orderId = new URL(request.url).searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  try {
    await cancelOrder(orderId, actor, request);
    invalidateOperationalDataCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "The shared database is unavailable, so the order was not removed. Try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order could not be canceled." }, { status: 400 });
  }
}
