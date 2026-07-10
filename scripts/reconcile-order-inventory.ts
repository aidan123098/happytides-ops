import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { InventoryMovementType, Prisma, PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { calculateInventoryReconciliation } from "@/lib/inventory-reconciliation";

config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const actorEmail = process.argv.find((argument) => argument.startsWith("--actor-email="))?.split("=")[1];

async function snapshot(client: Prisma.TransactionClient | PrismaClient) {
  const [orders, batches] = await Promise.all([
    client.order.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
        items: { select: { id: true, inventoryBatchId: true, quantity: true } },
        payments: { select: { id: true, status: true, paidAt: true } }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    }),
    client.inventoryBatch.findMany({
      where: { archivedAt: null },
      select: { id: true, productId: true, batchNumber: true, lotNumber: true, quantityOnHand: true, quantityReserved: true, quantitySold: true },
      orderBy: { id: "asc" }
    })
  ]);
  return { orders, batches };
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function report(data: Awaited<ReturnType<typeof snapshot>>) {
  const rows = calculateInventoryReconciliation(data.orders, data.batches);
  const totals = (key: "quantityOnHand" | "quantityReserved" | "quantitySold", side: "before" | "after") => rows.reduce((sum, row) => sum + row[side][key], 0);
  return {
    activeOrders: data.orders.length,
    orderItems: data.orders.reduce((sum, order) => sum + order.items.length, 0),
    inventoryBatches: data.batches.length,
    changedBatches: rows.filter((row) => row.changed).length,
    before: { total: totals("quantityOnHand", "before"), reservedPaid: totals("quantityReserved", "before"), sold: totals("quantitySold", "before") },
    after: { total: totals("quantityOnHand", "after"), reservedPaid: totals("quantityReserved", "after"), sold: totals("quantitySold", "after") },
    rows
  };
}

async function main() {
  const before = await snapshot(prisma);
  const dryRun = report(before);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...dryRun, rows: dryRun.rows.filter((row) => row.changed) }, null, 2));
  if (!apply) return;

  if (process.env.RECONCILE_CONFIRM !== "PRESERVE_ALL_ORDERS" || !actorEmail) {
    throw new Error("Apply requires RECONCILE_CONFIRM=PRESERVE_ALL_ORDERS and --actor-email=<existing user>.");
  }
  const actor = await prisma.user.findUnique({ where: { email: actorEmail } });
  if (!actor) throw new Error("Reconciliation actor was not found.");

  const runId = `inventory-reconciliation-${new Date().toISOString()}-${randomUUID()}`;
  const backupDir = process.env.HAPPYTIDES_BACKUP_DIR ?? path.resolve(process.cwd(), "..", "happytides-backups");
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${runId}.json`);
  await writeFile(backupPath, JSON.stringify({ runId, fingerprint: fingerprint(before), snapshot: before, planned: dryRun.rows }, null, 2), { mode: 0o600 });
  await chmod(backupPath, 0o600);

  await prisma.$transaction(async (tx) => {
    const current = await snapshot(tx);
    if (fingerprint(current) !== fingerprint(before)) throw new Error("Production data changed after the backup. No reconciliation was applied.");
    const currentReport = report(current);

    for (const row of currentReport.rows.filter((candidate) => candidate.changed)) {
      const updated = await tx.inventoryBatch.updateMany({
        where: { id: row.id, quantityOnHand: row.before.quantityOnHand, quantityReserved: row.before.quantityReserved, quantitySold: row.before.quantitySold },
        data: row.after
      });
      if (updated.count !== 1) throw new Error(`Batch ${row.id} changed during reconciliation.`);
      await tx.inventoryMovement.create({
        data: {
          batchId: row.id,
          type: InventoryMovementType.MANUAL_ADJUSTMENT,
          quantityDelta: row.after.quantityOnHand - row.before.quantityOnHand,
          quantityBefore: row.before.quantityOnHand,
          quantityAfter: row.after.quantityOnHand,
          reason: "Reconciled inventory counters to active order statuses.",
          adjustedById: actor.id,
          referenceType: "INVENTORY_RECONCILIATION",
          referenceId: runId
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          entityType: "INVENTORY",
          entityId: row.id,
          action: "INVENTORY_RECONCILED",
          before: row.before,
          after: row.after,
          metadata: { runId, backupPath }
        }
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });

  const after = await snapshot(prisma);
  if (after.orders.length !== before.orders.length || after.orders.reduce((sum, order) => sum + order.items.length, 0) !== before.orders.reduce((sum, order) => sum + order.items.length, 0)) {
    throw new Error("Order verification failed after reconciliation.");
  }
  console.log(JSON.stringify({ applied: true, runId, backupPath, fingerprintBefore: fingerprint(before), final: report(after) }, null, 2));
}

main().finally(() => prisma.$disconnect());
