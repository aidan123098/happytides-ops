import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { isDatabaseUnavailable } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await requirePermission("dashboard:read");

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ revision: "offline" });
  }

  try {
    const latest = await prisma.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true }
    });

    return NextResponse.json({
      revision: latest ? `${latest.createdAt.toISOString()}:${latest.id}` : "empty"
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 });
    }

    throw error;
  }
}
