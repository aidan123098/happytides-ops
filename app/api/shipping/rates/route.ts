import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { prepareShippingRates } from "@/lib/services/shipping";
import { shippingRateRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const actor = await requirePermission("orders:manage");
  const parsed = shippingRateRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the parcel details." }, { status: 400 });
  try {
    return NextResponse.json(await prepareShippingRates(parsed.data, actor));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Rates could not be loaded." }, { status: 400 });
  }
}
