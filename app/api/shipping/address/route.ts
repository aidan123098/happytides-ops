import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { getOrderById, invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { updateOrderShippingAddress } from "@/lib/services/shipping";
import { shippingAddressSchema } from "@/lib/validation";

const inputSchema = z.object({
  orderId: z.string().min(1),
  address: shippingAddressSchema,
  saveAsCustomerDefault: z.boolean().default(true)
});

export async function PATCH(request: Request) {
  const actor = await requirePermission("orders:manage");
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the shipping address." }, { status: 400 });
  try {
    await updateOrderShippingAddress(parsed.data, actor, request);
    invalidateOperationalDataCache();
    return NextResponse.json({ order: await getOrderById(parsed.data.orderId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The shipping address could not be saved." }, { status: 400 });
  }
}
