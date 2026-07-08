import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getDashboardData } from "@/lib/live-metrics";
import { getAnalyticsStore } from "@/lib/services/operational-data";

export async function GET() {
  await requirePermission("dashboard:read");
  const dashboard = getDashboardData(await getAnalyticsStore());

  return NextResponse.json({
    metrics: dashboard.metrics,
    revenueSeries: dashboard.revenueSeries,
    products: dashboard.products,
    locationSales: dashboard.locationSales,
    inventoryWarnings: dashboard.metrics.lowStock,
    recentOrders: dashboard.recentOrders
  });
}
