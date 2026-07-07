import { getOfflineStore, isDatabaseUnavailable } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { getOperationalStore } from "@/lib/services/operational-data";

const globalForLocalStore = globalThis as unknown as {
  happytidesDatabaseUnavailable: boolean | undefined;
  happytidesWarnedAboutDatabaseFallback: boolean | undefined;
};

export async function getLocalStore() {
  if (!process.env.DATABASE_URL) {
    globalForLocalStore.happytidesDatabaseUnavailable = true;
    return getOfflineStore();
  }

  if (globalForLocalStore.happytidesDatabaseUnavailable) return getOfflineStore();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return await getOperationalStore();
  } catch (error) {
    globalForLocalStore.happytidesDatabaseUnavailable = true;
    const expectedDemoFallback = !process.env.DATABASE_URL && isDatabaseUnavailable(error);

    if (!expectedDemoFallback && !globalForLocalStore.happytidesWarnedAboutDatabaseFallback) {
      globalForLocalStore.happytidesWarnedAboutDatabaseFallback = true;
      console.warn("Database unavailable; using local seed data for read-only pages.", error);
    }
    return getOfflineStore();
  }
}

export function saveLocalStore() {
  throw new Error("Local JSON storage has been retired. Use Prisma-backed services for mutations.");
}
