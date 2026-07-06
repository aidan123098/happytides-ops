import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { cancelOfflineOrder, createOfflineOrder, isDatabaseUnavailable, updateOfflineOrder } from "@/lib/offline-store";
import { getLocalStore } from "@/lib/local-store";
import { cancelOrder, createOrder, updateOrder } from "@/lib/services/operations";
import { orderInputSchema, orderUpdateSchema } from "@/lib/validation";

async function domainOrder(id: string) {
  return (await getLocalStore()).orders.find((order) => order.id === id);
}

export async function GET() {
  await requirePermission("orders:read");
  const orders = (await getLocalStore()).orders.filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled");
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const actor = await requirePermission("orders:create");
  const payload = orderInputSchema.parse(await request.json());

  try {
    const order = await createOrder(payload, actor, request);
    return NextResponse.json({ order: await domainOrder(order.id) }, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const order = createOfflineOrder(payload, actor);
      return NextResponse.json({ order }, { status: 201 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order could not be recorded." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const actor = await requirePermission("orders:manage");
  const payload = orderUpdateSchema.parse(await request.json());

  try {
    const order = await updateOrder(payload.orderId, payload, actor, request);
    return NextResponse.json({ order: await domainOrder(order.id) });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const order = updateOfflineOrder(payload.orderId, payload, actor);
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      return NextResponse.json({ order });
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
    const order = await cancelOrder(orderId, actor, request);
    return NextResponse.json({ order });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const order = cancelOfflineOrder(orderId, actor);
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      return NextResponse.json({ order });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order could not be canceled." }, { status: 400 });
  }
}
