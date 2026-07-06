import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getDashboardData } from "@/lib/live-metrics";
import { getLocalStore } from "@/lib/local-store";

export async function GET() {
  await requirePermission("dashboard:read");
  const dashboard = getDashboardData(await getLocalStore());

  return NextResponse.json({
    metrics: dashboard.metrics,
    revenueSeries: dashboard.revenueSeries,
    products: dashboard.products,
    locationSales: dashboard.locationSales,
    inventoryWarnings: dashboard.metrics.lowStock,
    recentOrders: dashboard.recentOrders
  });
}
