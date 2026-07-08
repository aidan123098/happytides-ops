import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/live-metrics";
import { getAnalyticsStore } from "@/lib/services/operational-data";

export async function GET() {
  await requirePermission("dashboard:read");
  return NextResponse.json(getDashboardSnapshot(await getAnalyticsStore()));
}
