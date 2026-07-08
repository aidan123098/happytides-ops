import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getAnalyticsSummaryFromStore } from "@/lib/live-metrics";
import { getAnalyticsStore } from "@/lib/services/operational-data";

export async function GET() {
  await requirePermission("reports:read");
  return NextResponse.json(getAnalyticsSummaryFromStore(await getAnalyticsStore()));
}
