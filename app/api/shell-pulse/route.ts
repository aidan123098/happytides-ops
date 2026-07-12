import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getShellPulse } from "@/lib/services/operational-data";

export async function GET() {
  await requirePermission("dashboard:read", { touchActivity: false });
  return NextResponse.json({ pulse: await getShellPulse() });
}
