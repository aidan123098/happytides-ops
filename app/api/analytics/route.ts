import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getAnalyticsSummaryFromStore } from "@/lib/live-metrics";
import { getLocalStore } from "@/lib/local-store";

export async function GET() {
  await requirePermission("reports:read");
  return NextResponse.json(getAnalyticsSummaryFromStore(await getLocalStore()));
}
