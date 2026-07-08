import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { isDatabaseUnavailable } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";

const revisionCacheTtlMs = 30 * 1000;
const globalForRevision = globalThis as unknown as {
  happytidesRevisionCache: { revision: string; expiresAt: number } | undefined;
};

export async function GET() {
  try {
    await requirePermission("dashboard:read", { touchActivity: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Permission denied")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    throw error;
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ revision: "offline" });
  }

  try {
    if (globalForRevision.happytidesRevisionCache && globalForRevision.happytidesRevisionCache.expiresAt > Date.now()) {
      return NextResponse.json({ revision: globalForRevision.happytidesRevisionCache.revision });
    }

    const latest = await prisma.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true }
    });
    const revision = latest ? `${latest.createdAt.toISOString()}:${latest.id}` : "empty";
    globalForRevision.happytidesRevisionCache = { revision, expiresAt: Date.now() + revisionCacheTtlMs };

    return NextResponse.json({ revision });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 });
    }

    throw error;
  }
}
