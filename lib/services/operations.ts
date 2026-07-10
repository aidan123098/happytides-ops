import type { Prisma } from "@prisma/client";
import { FulfillmentStatus, InventoryMovementType, InventoryStatus, PaymentMethod, PaymentStatus, CustomerSource, CustomerStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { transitionInventoryCounts } from "@/lib/inventory-counts";
import { isPaidStage, isReservedStage, isSoldStage, orderStageFromPersistence, persistenceForOrderStage, type OrderStage } from "@/lib/order-stage";
import { assertLotCanAllocate } from "@/lib/services/inventory-policy";
import type { Customer } from "@/types/domain";

type Tx = Prisma.TransactionClient;

type OrderPayload = {
  customerId: string;
  customerName?: string;
  affiliateId?: string;
  locationId?: string;
  paymentMethod: "Processor" | "Cash" | "Zelle" | "Venmo" | "ACH" | "Crypto" | "Other";
  paidTo?: string;
  squarePaymentId?: string;
  status?: OrderStage;
  fulfillmentStatus?: Exclude<OrderStage, "paid">;
  createdAt?: string;
  items: Array<{
    productId: string;
    inventoryBatchId: string;
    quantity: number;
    unitPriceCents: number;
    discountCents: number;
  }>;
  notes?: string;
};

function requestedStage(payload: Pick<OrderPayload, "status" | "fulfillmentStatus">, fallback: OrderStage = "unfulfilled") {
  return payload.status ?? payload.fulfillmentStatus ?? fallback;
}

function parsedCreatedAt(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const paymentMethodMap: Record<OrderPayload["paymentMethod"], PaymentMethod> = {
  Processor: PaymentMethod.SQUARE_CARD,
  Cash: PaymentMethod.CASH,
  Zelle: PaymentMethod.ZELLE,
  Venmo: PaymentMethod.VENMO,
  ACH: PaymentMethod.ACH,
  Crypto: PaymentMethod.OTHER,
  Other: PaymentMethod.OTHER
};

const sourceMap: Record<Customer["source"], CustomerSource> = {
  "walk-in": CustomerSource.WALK_IN,
  referral: CustomerSource.REFERRAL,
  event: CustomerSource.EVENT,
  Instagram: CustomerSource.INSTAGRAM,
  website: CustomerSource.WEBSITE,
  other: CustomerSource.OTHER
};

const statusMap: Record<Customer["status"], CustomerStatus> = {
  new: CustomerStatus.NEW,
  returning: CustomerStatus.RETURNING,
  VIP: CustomerStatus.VIP,
  inactive: CustomerStatus.INACTIVE
};

function aggregateByBatch(items: OrderPayload["items"]) {
  const aggregate = new Map<string, { productId: string; quantity: number }>();

  for (const item of items) {
    const current = aggregate.get(item.inventoryBatchId) ?? { productId: item.productId, quantity: 0 };

    if (current.productId !== item.productId) {
      throw new Error("A lot cannot be allocated to multiple products in the same order.");
    }

    current.quantity += item.quantity;
    aggregate.set(item.inventoryBatchId, current);
  }

  return aggregate;
}

type InventoryItem = { inventoryBatchId: string | null; productId: string; quantity: number };

function inventoryByBatch(items: InventoryItem[], stage: OrderStage) {
  const result = new Map<string, { productId: string; reserved: number; sold: number }>();
  if (!isReservedStage(stage) && !isSoldStage(stage)) return result;
  for (const item of items) {
    if (!item.inventoryBatchId) continue;
    const current = result.get(item.inventoryBatchId) ?? { productId: item.productId, reserved: 0, sold: 0 };
    if (current.productId !== item.productId) throw new Error("A lot cannot be allocated to multiple products in the same order.");
    if (isReservedStage(stage)) current.reserved += item.quantity;
    if (isSoldStage(stage)) current.sold += item.quantity;
    result.set(item.inventoryBatchId, current);
  }
  return result;
}

function inventoryAllowance(items: InventoryItem[], stage: OrderStage) {
  const allowance = new Map<string, number>();
  if (!isReservedStage(stage) && !isSoldStage(stage)) return allowance;
  for (const item of items) {
    if (!item.inventoryBatchId) continue;
    allowance.set(item.inventoryBatchId, (allowance.get(item.inventoryBatchId) ?? 0) + item.quantity);
  }
  return allowance;
}

async function transitionOrderInventory(tx: Tx, previousItems: InventoryItem[], previousStage: OrderStage, nextItems: InventoryItem[], nextStage: OrderStage, actor: SessionUser, reason: string) {
  const previous = inventoryByBatch(previousItems, previousStage);
  const next = inventoryByBatch(nextItems, nextStage);
  const ids = [...new Set([...previous.keys(), ...next.keys()])];
  if (ids.length === 0) return [];

  const batches = await tx.inventoryBatch.findMany({ where: { id: { in: ids }, archivedAt: null } });
  if (batches.length !== ids.length) throw new Error("Selected inventory lot was not found.");
  const changedIds: string[] = [];

  await Promise.all(batches.map(async (batch) => {
    const before = previous.get(batch.id) ?? { productId: batch.productId, reserved: 0, sold: 0 };
    const after = next.get(batch.id) ?? { productId: batch.productId, reserved: 0, sold: 0 };
    if (before.productId !== batch.productId || after.productId !== batch.productId) throw new Error("Selected lot does not belong to the selected product.");

    const { counts, reservedDelta, soldDelta } = transitionInventoryCounts(batch, before, after);
    if (reservedDelta === 0 && soldDelta === 0) return;

    const availableBefore = batch.quantityOnHand - batch.quantityReserved;
    const availableAfter = counts.quantityOnHand - counts.quantityReserved;
    if (availableAfter < availableBefore) {
      assertLotCanAllocate(batch, { productId: after.productId, quantity: availableBefore - availableAfter });
    }

    await Promise.all([
      tx.inventoryBatch.update({ where: { id: batch.id }, data: counts }),
      tx.inventoryMovement.create({
        data: {
          batchId: batch.id,
          type: soldDelta > 0 ? InventoryMovementType.ORDER_FULFILLMENT : reservedDelta > 0 ? InventoryMovementType.ORDER_RESERVATION : InventoryMovementType.ORDER_CANCELLATION,
          quantityDelta: -soldDelta,
          quantityBefore: batch.quantityOnHand,
          quantityAfter: counts.quantityOnHand,
          reason,
          adjustedById: actor.id,
          referenceType: "ORDER",
          referenceId: reason
        }
      })
    ]);
    changedIds.push(batch.id);
  }));

  return changedIds;
}

async function validateInventory(tx: Tx, items: OrderPayload["items"], allowance = new Map<string, number>()) {
  const aggregate = aggregateByBatch(items);
  const batches = await tx.inventoryBatch.findMany({
    where: { id: { in: [...aggregate.keys()] } }
  });

  for (const [batchId, requested] of aggregate.entries()) {
    const batch = batches.find((item) => item.id === batchId);

    if (!batch) {
      throw new Error("Selected inventory lot was not found.");
    }

    assertLotCanAllocate({ ...batch, quantityOnHand: batch.quantityOnHand + (allowance.get(batchId) ?? 0) }, requested);
  }
}

async function recalculateCustomerStats(tx: Tx, customerId: string) {
  const where = {
    customerId,
    archivedAt: null,
    paymentStatus: PaymentStatus.PAID
  } satisfies Prisma.OrderWhereInput;
  const [orderStats, productCounts] = await Promise.all([
    tx.order.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalCents: true },
      _min: { createdAt: true },
      _max: { createdAt: true }
    }),
    tx.orderItem.groupBy({
      by: ["productId"],
      where: { order: where },
      _sum: { quantity: true }
    })
  ]);
  const totalSpendCents = orderStats._sum.totalCents ?? 0;
  const orderCount = orderStats._count._all;
  const favorite = productCounts.sort((left, right) => (right._sum.quantity ?? 0) - (left._sum.quantity ?? 0))[0];

  await tx.customer.update({
    where: { id: customerId },
    data: {
      totalSpendCents,
      orderCount,
      averageOrderValueCents: Math.round(totalSpendCents / Math.max(orderCount, 1)),
      firstPurchaseAt: orderStats._min.createdAt,
      lastPurchaseAt: orderStats._max.createdAt,
      favoriteProductId: favorite?.productId,
      status: orderCount > 1 ? CustomerStatus.RETURNING : CustomerStatus.NEW
    }
  });
}

async function recalculateAffiliateMetrics(tx: Tx, affiliateId?: string | null) {
  if (!affiliateId) return;

  const affiliate = await tx.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) return;

  const where = { affiliateId, archivedAt: null, paymentStatus: PaymentStatus.PAID } satisfies Prisma.OrderWhereInput;
  const [orderStats, referredCustomerRows] = await Promise.all([
    tx.order.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalCents: true }
    }),
    tx.order.findMany({
      where,
      distinct: ["customerId"],
      select: { customerId: true }
    })
  ]);
  const revenueGeneratedCents = orderStats._sum.totalCents ?? 0;
  const referredCustomers = referredCustomerRows.length;
  const earned = Math.round((revenueGeneratedCents * affiliate.payoutRateBps) / 10000);
  const payoutDueCents = Math.max(earned - affiliate.totalPayoutCents, 0);

  await tx.affiliate.update({
    where: { id: affiliateId },
    data: {
      revenueGeneratedCents,
      referredOrders: orderStats._count._all,
      referredCustomers,
      payoutDueCents
    }
  });
}

export async function createOrder(payload: OrderPayload, actor: SessionUser, request?: Request) {
  return prisma.$transaction(async (tx) => {
    const [customer, affiliate] = await Promise.all([
      tx.customer.findUnique({ where: { id: payload.customerId } }),
      payload.affiliateId ? tx.affiliate.findUnique({ where: { id: payload.affiliateId } }) : Promise.resolve(null)
    ]);
    if (!customer) throw new Error("Customer not found.");
    if (payload.affiliateId && !affiliate) throw new Error("Affiliate not found.");

    await validateInventory(tx, payload.items);

    const subtotalCents = payload.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const discountCents = payload.items.reduce((sum, item) => sum + item.discountCents, 0);
    const totalCents = subtotalCents - discountCents;
    const orderNumber = `HT-${Date.now().toString().slice(-6)}`;
    const stage = requestedStage(payload);
    const persistedStage = persistenceForOrderStage(stage);
    const createdAt = parsedCreatedAt(payload.createdAt);
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: payload.customerId,
        staffMemberId: actor.id,
        subtotalCents,
        discountCents,
        taxCents: 0,
        totalCents,
        paidTo: payload.paidTo,
        paymentStatus: persistedStage.paymentStatus,
        fulfillmentStatus: persistedStage.fulfillmentStatus,
        status: persistedStage.status,
        orderSource: payload.locationId ?? "Manual entry",
        affiliateId: payload.affiliateId,
        notes: payload.notes,
        createdAt,
        items: {
          create: payload.items.map((item) => ({
            productId: item.productId,
            inventoryBatchId: item.inventoryBatchId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            discountCents: item.discountCents,
            taxCents: 0,
            totalCents: item.unitPriceCents * item.quantity - item.discountCents
          }))
        },
        payments: {
          create: {
            method: paymentMethodMap[payload.paymentMethod],
            status: persistedStage.paymentStatus,
            amountCents: totalCents,
            squarePaymentId: payload.squarePaymentId,
            paidAt: isPaidStage(stage) ? new Date() : null
          }
        }
      },
      include: { items: true }
    });

    await transitionOrderInventory(tx, [], "unfulfilled", order.items, stage, actor, order.orderNumber);

    if (isPaidStage(stage)) {
      await Promise.all([recalculateCustomerStats(tx, payload.customerId), recalculateAffiliateMetrics(tx, payload.affiliateId)]);
    }
    await writeAuditLog({ actor, entityType: "ORDER", entityId: order.id, action: "ORDER_CREATED", after: order, request }, tx);

    return order;
  });
}

export async function updateOrder(orderId: string, payload: OrderPayload, actor: SessionUser, request?: Request) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true }
    });
    if (!existing || existing.archivedAt) throw new Error("Order not found.");

    const previousStage = orderStageFromPersistence(existing);
    const stage = requestedStage(payload, previousStage);
    await validateInventory(tx, payload.items, inventoryAllowance(existing.items, previousStage));
    const changedBatchIds = await transitionOrderInventory(tx, existing.items, previousStage, payload.items, stage, actor, existing.orderNumber);

    const subtotalCents = payload.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const discountCents = payload.items.reduce((sum, item) => sum + item.discountCents, 0);
    const totalCents = subtotalCents - discountCents;
    const persistedStage = persistenceForOrderStage(stage);
    const createdAt = parsedCreatedAt(payload.createdAt);

    await tx.orderItem.deleteMany({ where: { orderId } });
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        customerId: payload.customerId,
        subtotalCents,
        discountCents,
        totalCents,
        paidTo: payload.paidTo,
        orderSource: payload.locationId ?? existing.orderSource,
        paymentStatus: persistedStage.paymentStatus,
        fulfillmentStatus: persistedStage.fulfillmentStatus,
        status: persistedStage.status,
        affiliateId: payload.affiliateId,
        notes: payload.notes,
        createdAt,
        items: {
          create: payload.items.map((item) => ({
            productId: item.productId,
            inventoryBatchId: item.inventoryBatchId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            discountCents: item.discountCents,
            taxCents: 0,
            totalCents: item.unitPriceCents * item.quantity - item.discountCents
          }))
        },
        payments: {
          updateMany: {
            where: { orderId },
            data: {
              method: paymentMethodMap[payload.paymentMethod],
              amountCents: totalCents,
              status: persistedStage.paymentStatus,
              paidAt: isPaidStage(stage) ? existing.payments[0]?.paidAt ?? new Date() : null
            }
          }
        }
      },
      include: { items: true }
    });

    if (isPaidStage(previousStage) || isPaidStage(stage)) {
      await Promise.all([
        recalculateCustomerStats(tx, existing.customerId),
        existing.customerId !== payload.customerId ? recalculateCustomerStats(tx, payload.customerId) : Promise.resolve(),
        recalculateAffiliateMetrics(tx, existing.affiliateId),
        existing.affiliateId !== payload.affiliateId ? recalculateAffiliateMetrics(tx, payload.affiliateId) : Promise.resolve()
      ]);
    }
    await writeAuditLog({ actor, entityType: "ORDER", entityId: updated.id, action: "UPDATE", before: existing, after: updated, request }, tx);

    return { order: updated, changedBatchIds };
  });
}

export async function changeOrderStatus(orderId: string, stage: OrderStage, actor: SessionUser, request?: Request) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true }
    });
    if (!existing || existing.archivedAt) throw new Error("Order not found.");

    const previousStage = orderStageFromPersistence(existing);
    if (previousStage === stage) return { order: existing, changedBatchIds: [] as string[] };

    const changedBatchIds = await transitionOrderInventory(tx, existing.items, previousStage, existing.items, stage, actor, existing.orderNumber);
    const persistedStage = persistenceForOrderStage(stage);
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: persistedStage.paymentStatus,
        fulfillmentStatus: persistedStage.fulfillmentStatus,
        status: persistedStage.status,
        payments: {
          updateMany: {
            where: { orderId },
            data: {
              status: persistedStage.paymentStatus,
              paidAt: isPaidStage(stage) ? existing.payments[0]?.paidAt ?? new Date() : null
            }
          }
        }
      },
      include: { items: true }
    });

    if (isPaidStage(previousStage) !== isPaidStage(stage)) {
      await Promise.all([recalculateCustomerStats(tx, existing.customerId), recalculateAffiliateMetrics(tx, existing.affiliateId)]);
    }
    await writeAuditLog({ actor, entityType: "ORDER", entityId: orderId, action: "STATUS_CHANGED", before: { status: previousStage }, after: { status: stage }, request }, tx);
    return { order: updated, changedBatchIds };
  });
}

export async function cancelOrder(orderId: string, actor: SessionUser, request?: Request) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    if (!existing || existing.archivedAt) throw new Error("Order not found.");

    const previousStage = orderStageFromPersistence(existing);
    await transitionOrderInventory(tx, existing.items, previousStage, [], "unfulfilled", actor, existing.orderNumber);

    const canceled = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELED,
        paymentStatus: PaymentStatus.CANCELED,
        fulfillmentStatus: FulfillmentStatus.CANCELED,
        canceledAt: new Date(),
        archivedAt: new Date()
      }
    });

    await Promise.all([recalculateCustomerStats(tx, existing.customerId), recalculateAffiliateMetrics(tx, existing.affiliateId)]);
    await writeAuditLog({ actor, entityType: "ORDER", entityId: existing.id, action: "ORDER_CANCELED", before: existing, after: canceled, request }, tx);

    return canceled;
  });
}

export async function adjustInventory(payload: { batchId: string; quantityDelta: number; reason: string; status?: string }, actor: SessionUser, request?: Request) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.inventoryBatch.findUnique({ where: { id: payload.batchId } });
    if (!batch || batch.archivedAt) throw new Error("Inventory batch not found.");

    const quantityBefore = batch.quantityOnHand;
    const quantityAfter = quantityBefore + payload.quantityDelta;
    if (quantityAfter < 0) throw new Error("Inventory cannot go negative.");

    const updated = await tx.inventoryBatch.update({
      where: { id: payload.batchId },
      data: {
        quantityOnHand: quantityAfter,
        status: payload.status ? (payload.status.toUpperCase() as InventoryStatus) : batch.status
      }
    });

    await tx.inventoryMovement.create({
      data: {
        batchId: batch.id,
        type: InventoryMovementType.MANUAL_ADJUSTMENT,
        quantityDelta: payload.quantityDelta,
        quantityBefore,
        quantityAfter,
        reason: payload.reason,
        adjustedById: actor.id,
        referenceType: "INVENTORY_ADJUSTMENT",
        referenceId: batch.id
      }
    });

    await writeAuditLog({ actor, entityType: "INVENTORY", entityId: batch.id, action: "INVENTORY_ADJUSTED", before: batch, after: updated, metadata: { reason: payload.reason }, request }, tx);
    return updated;
  });
}

export async function createCustomer(payload: Omit<Customer, "id" | "totalSpendCents" | "orderCount" | "averageOrderValueCents" | "favoriteProduct" | "firstPurchaseAt" | "lastPurchaseAt">, actor: SessionUser, request?: Request) {
  const customer = await prisma.customer.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email === "N/A" ? null : payload.email,
      phone: payload.phone === "N/A" ? null : payload.phone,
      smsConsent: payload.smsConsent,
      emailConsent: payload.emailConsent,
      source: sourceMap[payload.source],
      status: statusMap[payload.status],
      notes: payload.notes === "N/A" ? null : payload.notes
    }
  });
  await writeAuditLog({ actor, entityType: "CUSTOMER", entityId: customer.id, action: "CREATE", after: customer, request });
  return customer;
}
