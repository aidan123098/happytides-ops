import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { isDatabaseUnavailable } from "@/lib/offline-store";
import { syncSquareData } from "@/lib/square";

export async function POST() {
  const actor = await requirePermission("settings:manage");
  const result = await syncSquareData();

  try {
    await writeAuditLog({
      actor,
      entityType: "SQUARE",
      entityId: "manual-sync",
      action: "square.sync.requested",
      after: result
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  return NextResponse.json(result, { status: result.error ? 503 : 200 });
}
