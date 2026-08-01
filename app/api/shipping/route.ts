import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getShippingConfig, getShippingQueue } from "@/lib/services/shipping";

export async function GET() {
  await requirePermission("orders:read", { touchActivity: false });
  const [orders, config] = await Promise.all([getShippingQueue(), getShippingConfig()]);
  return NextResponse.json({ orders, config });
}
