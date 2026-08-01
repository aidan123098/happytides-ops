import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getShipStationSetup, getShippingConfig, saveShippingConfig } from "@/lib/services/shipping";
import { shippingConfigInputSchema } from "@/lib/validation";

export async function GET() {
  await requirePermission("integrations:manage", { touchActivity: false });
  return NextResponse.json({ config: await getShippingConfig() });
}

export async function POST() {
  await requirePermission("integrations:manage");
  try {
    return NextResponse.json(await getShipStationSetup());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ShipStation connection failed." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const actor = await requirePermission("integrations:manage");
  const parsed = shippingConfigInputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the shipping settings." }, { status: 400 });
  try {
    return NextResponse.json({ config: await saveShippingConfig(parsed.data, actor, request) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Shipping settings could not be saved." }, { status: 400 });
  }
}
