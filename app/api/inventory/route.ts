import { NextResponse } from "next/server";
import { InventoryMovementType, InventoryStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { isDatabaseUnavailable } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { getInventoryBatchById, getInventoryBatches, getInventoryMovements, invalidateOperationalDataCache } from "@/lib/services/operational-data";
import { adjustInventory } from "@/lib/services/operations";
import { inventoryAdjustmentSchema, inventoryBatchInputSchema } from "@/lib/validation";

function validationError(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error.issues as Array<{ path: Array<string | number>; message: string }>) : [];
  const firstIssue = issues[0];
  const path = firstIssue?.path.length ? `${firstIssue.path.join(".")}: ` : "";
  const detail = firstIssue ? `${path}${firstIssue.message}` : "Check the required fields and try again.";
  return NextResponse.json({ error: detail }, { status: 400 });
}

export async function GET() {
  await requirePermission("inventory:read");
  const [batches, movements] = await Promise.all([getInventoryBatches(), getInventoryMovements()]);
  return NextResponse.json({ batches, movements });
}

export async function POST(request: Request) {
  const actor = await requirePermission("inventory:manage");
  const body = await request.json();

  if ("productId" in body || "batchNumber" in body) {
    const parsed = inventoryBatchInputSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const payload = parsed.data;
    const expirationDate = new Date(payload.expirationDate);

    if (Number.isNaN(expirationDate.getTime())) {
      return NextResponse.json({ error: "expirationDate must be a valid date." }, { status: 400 });
    }

    try {
      const batch = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: payload.productId } });
        if (!product || product.archivedAt) throw new Error("Product not found.");

        const created = await tx.inventoryBatch.create({
          data: {
            productId: payload.productId,
            quantityOnHand: payload.quantityOnHand,
            reorderThreshold: payload.reorderThreshold ?? 10,
            batchNumber: payload.batchNumber.trim(),
            lotNumber: payload.lotNumber.trim(),
            expirationDate,
            supplier: payload.supplier.trim(),
            costPerVialCents: payload.costPerVialCents,
            storageRequirements: payload.storageRequirements.trim(),
            coaDocumentUrl: payload.coaDocumentUrl?.trim() || null,
            status: payload.status.toUpperCase() as InventoryStatus
          }
        });

        await tx.inventoryMovement.create({
          data: {
            batchId: created.id,
            type: InventoryMovementType.INITIAL_RECEIPT,
            quantityDelta: payload.quantityOnHand,
            quantityBefore: 0,
            quantityAfter: payload.quantityOnHand,
            reason: payload.reason,
            adjustedById: actor.id,
            referenceType: "INVENTORY_RECEIPT",
            referenceId: created.id
          }
        });

        await writeAuditLog({ actor, entityType: "INVENTORY", entityId: created.id, action: "INVENTORY_BATCH_RECEIVED", after: created, metadata: { reason: payload.reason }, request }, tx);
        return created;
      });
      invalidateOperationalDataCache();
      const domainBatch = await getInventoryBatchById(batch.id);
      return NextResponse.json({ batch: domainBatch ?? batch }, { status: 201 });
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return NextResponse.json({ error: "The shared database is unavailable, so the stock was not received. Try again in a moment." }, { status: 503 });
      }
      return NextResponse.json({ error: error instanceof Error ? error.message : "Inventory batch could not be received." }, { status: 400 });
    }
  }

  const parsed = inventoryAdjustmentSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;

  try {
    const batch = await adjustInventory(payload, actor, request);
    invalidateOperationalDataCache();
    const domainBatch = await getInventoryBatchById(batch.id);
    return NextResponse.json({ batch: domainBatch ?? batch });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "The shared database is unavailable, so the inventory change was not saved. Try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Inventory adjustment failed." }, { status: 400 });
  }
}
