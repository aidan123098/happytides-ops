import { getOfflineStore, isDatabaseUnavailable } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { getOperationalStore } from "@/lib/services/operational-data";

const globalForLocalStore = globalThis as unknown as {
  happytidesWarnedAboutDatabaseFallback: boolean | undefined;
};

export async function getLocalStore() {
  if (!process.env.DATABASE_URL) {
    return getOfflineStore();
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return await getOperationalStore();
  } catch (error) {
    const expectedDemoFallback = isDatabaseUnavailable(error) && !process.env.VERCEL;

    if (!expectedDemoFallback && !globalForLocalStore.happytidesWarnedAboutDatabaseFallback) {
      globalForLocalStore.happytidesWarnedAboutDatabaseFallback = true;
      console.warn("Database unavailable; refusing to serve stale seed data while DATABASE_URL is configured.", error);
    }

    if (!expectedDemoFallback) throw error;
    return getOfflineStore();
  }
}

export function saveLocalStore() {
  throw new Error("Local JSON storage has been retired. Use Prisma-backed services for mutations.");
}
