import type { Prisma } from "@prisma/client";
import { FulfillmentStatus, InventoryMovementType, InventoryStatus, PaymentMethod, PaymentStatus, CustomerSource, CustomerStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { assertLotCanAllocate } from "@/lib/services/inventory-policy";
import type { Customer } from "@/types/domain";

type Tx = Prisma.TransactionClient;

type OrderPayload = {
  customerId: string;
  customerName?: string;
  affiliateId?: string;
  locationId?: string;
  paymentMethod: "Processor" | "Cash" | "Zelle" | "Venmo" | "ACH" | "Crypto" | "Other";
  squarePaymentId?: string;
  fulfillmentStatus?: "unfulfilled" | "packed" | "shipped" | "delivered";
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

function fulfillmentStatusForStage(stage: OrderPayload["fulfillmentStatus"]) {
  if (stage === "packed" || stage === "shipped") return FulfillmentStatus.PACKED;
  if (stage === "delivered") return FulfillmentStatus.FULFILLED;
  return FulfillmentStatus.UNFULFILLED;
}

function orderStatusForStage(stage: OrderPayload["fulfillmentStatus"]) {
  if (stage === "packed") return OrderStatus.READY_TO_SHIP;
  if (stage === "shipped") return OrderStatus.SHIPPED;
  if (stage === "delivered") return OrderStatus.DELIVERED;
  return OrderStatus.PAID;
}

function isDelivered(stage: OrderPayload["fulfillmentStatus"]) {
  return stage === "delivered";
}

function parsedCreatedAt(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stageFromExisting(order: { fulfillmentStatus: FulfillmentStatus; status: OrderStatus }): OrderPayload["fulfillmentStatus"] {
  if (order.status === OrderStatus.SHIPPED) return "shipped";
  if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED || order.fulfillmentStatus === FulfillmentStatus.FULFILLED) return "delivered";
  if (order.fulfillmentStatus === FulfillmentStatus.PACKED || order.status === OrderStatus.READY_TO_SHIP || order.status === OrderStatus.PACKING) return "packed";
  return "unfulfilled";
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

async function reserveBatchForOrder(tx: Tx, batchId: string, quantity: number, actor: SessionUser, reason: string, orderItemId?: string) {
  const batch = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: batchId } });
  const quantityBefore = batch.quantityOnHand - batch.quantityReserved;

  await tx.inventoryBatch.update({
    where: { id: batchId },
    data: {
      quantityReserved: { increment: quantity }
    }
  });

  await tx.inventoryMovement.create({
    data: {
      batchId,
      type: InventoryMovementType.ORDER_RESERVATION,
      quantityDelta: 0,
      quantityBefore,
      quantityAfter: quantityBefore - quantity,
      reason,
      orderItemId,
      adjustedById: actor.id,
      referenceType: "ORDER",
      referenceId: reason
    }
  });
}

async function sellReservedBatchForOrder(tx: Tx, batchId: string, quantity: number, actor: SessionUser, reason: string, orderItemId?: string) {
  const batch = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: batchId } });
  const quantityBefore = batch.quantityOnHand;
  const quantityAfter = quantityBefore - quantity;

  if (quantityAfter < 0) {
    throw new Error("Inventory cannot go negative.");
  }

  await tx.inventoryBatch.update({
    where: { id: batchId },
    data: {
      quantityOnHand: quantityAfter,
      quantityReserved: { decrement: Math.min(batch.quantityReserved, quantity) },
      quantitySold: { increment: quantity }
    }
  });

  await tx.inventoryMovement.create({
    data: {
      batchId,
      type: InventoryMovementType.ORDER_FULFILLMENT,
      quantityDelta: -quantity,
      quantityBefore,
      quantityAfter,
      reason,
      orderItemId,
      adjustedById: actor.id,
      referenceType: "ORDER",
      referenceId: reason
    }
  });
}

async function releaseReservedBatchForOrder(tx: Tx, batchId: string, quantity: number, actor: SessionUser, reason: string, orderItemId?: string) {
  const batch = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: batchId } });
  const quantityBefore = batch.quantityOnHand - batch.quantityReserved;
  const release = Math.min(batch.quantityReserved, quantity);

  await tx.inventoryBatch.update({
    where: { id: batchId },
    data: {
      quantityReserved: { decrement: release }
    }
  });

  await tx.inventoryMovement.create({
    data: {
      batchId,
      type: InventoryMovementType.ORDER_CANCELLATION,
      quantityDelta: 0,
      quantityBefore,
      quantityAfter: quantityBefore + release,
      reason,
      orderItemId,
      adjustedById: actor.id,
      referenceType: "ORDER",
      referenceId: reason
    }
  });
}

async function restoreSoldBatchForOrder(tx: Tx, batchId: string, quantity: number, actor: SessionUser, reason: string, orderItemId?: string) {
  const batch = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: batchId } });
  const quantityBefore = batch.quantityOnHand;
  const quantityAfter = quantityBefore + quantity;

  await tx.inventoryBatch.update({
    where: { id: batchId },
    data: {
      quantityOnHand: quantityAfter,
      quantitySold: { decrement: Math.min(batch.quantitySold, quantity) }
    }
  });

  await tx.inventoryMovement.create({
    data: {
      batchId,
      type: InventoryMovementType.ORDER_CANCELLATION,
      quantityDelta: quantity,
      quantityBefore,
      quantityAfter,
      reason,
      orderItemId,
      adjustedById: actor.id,
      referenceType: "ORDER",
      referenceId: reason
    }
  });
}

async function releaseOrderInventory(tx: Tx, items: Array<{ inventoryBatchId: string | null; quantity: number; id?: string }>, stage: OrderPayload["fulfillmentStatus"], actor: SessionUser, reason: string) {
  for (const item of items) {
    if (!item.inventoryBatchId) continue;
    if (isDelivered(stage)) {
      await restoreSoldBatchForOrder(tx, item.inventoryBatchId, item.quantity, actor, reason, item.id);
    } else {
      await releaseReservedBatchForOrder(tx, item.inventoryBatchId, item.quantity, actor, reason, item.id);
    }
  }
}

async function applyOrderInventory(tx: Tx, items: Array<{ inventoryBatchId: string | null; quantity: number; id?: string }>, stage: OrderPayload["fulfillmentStatus"], actor: SessionUser, reason: string) {
  for (const item of items) {
    if (!item.inventoryBatchId) continue;
    if (isDelivered(stage)) {
      await sellReservedBatchForOrder(tx, item.inventoryBatchId, item.quantity, actor, reason, item.id);
    } else {
      await reserveBatchForOrder(tx, item.inventoryBatchId, item.quantity, actor, reason, item.id);
    }
  }
}

async function validateInventory(tx: Tx, items: OrderPayload["items"]) {
  const aggregate = aggregateByBatch(items);
  const batches = await tx.inventoryBatch.findMany({
    where: { id: { in: [...aggregate.keys()] } }
  });

  for (const [batchId, requested] of aggregate.entries()) {
    const batch = batches.find((item) => item.id === batchId);

    if (!batch) {
      throw new Error("Selected inventory lot was not found.");
    }

    assertLotCanAllocate(batch, requested);
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
    const customer = await tx.customer.findUnique({ where: { id: payload.customerId } });
    if (!customer) throw new Error("Customer not found.");

    if (payload.affiliateId) {
      const affiliate = await tx.affiliate.findUnique({ where: { id: payload.affiliateId } });
      if (!affiliate) throw new Error("Affiliate not found.");
    }

    await validateInventory(tx, payload.items);

    const subtotalCents = payload.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const discountCents = payload.items.reduce((sum, item) => sum + item.discountCents, 0);
    const totalCents = subtotalCents - discountCents;
    const orderNumber = `HT-${Date.now().toString().slice(-6)}`;
    const fulfillmentStage = payload.fulfillmentStatus ?? "unfulfilled";
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
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: fulfillmentStatusForStage(fulfillmentStage),
        status: orderStatusForStage(fulfillmentStage),
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
            status: PaymentStatus.PAID,
            amountCents: totalCents,
            squarePaymentId: payload.squarePaymentId,
            paidAt: new Date()
          }
        }
      },
      include: { items: true }
    });

    await applyOrderInventory(tx, order.items, fulfillmentStage, actor, order.orderNumber);

    await recalculateCustomerStats(tx, payload.customerId);
    await recalculateAffiliateMetrics(tx, payload.affiliateId);
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

    await releaseOrderInventory(tx, existing.items, stageFromExisting(existing), actor, existing.orderNumber);

    await validateInventory(tx, payload.items);

    const subtotalCents = payload.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const discountCents = payload.items.reduce((sum, item) => sum + item.discountCents, 0);
    const totalCents = subtotalCents - discountCents;
    const fulfillmentStage = payload.fulfillmentStatus ?? stageFromExisting(existing);
    const createdAt = parsedCreatedAt(payload.createdAt);

    await tx.orderItem.deleteMany({ where: { orderId } });
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        customerId: payload.customerId,
        subtotalCents,
        discountCents,
        totalCents,
        orderSource: payload.locationId ?? existing.orderSource,
        fulfillmentStatus: fulfillmentStatusForStage(fulfillmentStage),
        status: orderStatusForStage(fulfillmentStage),
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
              status: PaymentStatus.PAID
            }
          }
        }
      },
      include: { items: true }
    });

    await applyOrderInventory(tx, updated.items, fulfillmentStage, actor, updated.orderNumber);

    await recalculateCustomerStats(tx, existing.customerId);
    if (existing.customerId !== payload.customerId) await recalculateCustomerStats(tx, payload.customerId);
    await recalculateAffiliateMetrics(tx, existing.affiliateId);
    await recalculateAffiliateMetrics(tx, payload.affiliateId);
    await writeAuditLog({ actor, entityType: "ORDER", entityId: updated.id, action: "UPDATE", before: existing, after: updated, request }, tx);

    return updated;
  });
}

export async function cancelOrder(orderId: string, actor: SessionUser, request?: Request) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    if (!existing || existing.archivedAt) throw new Error("Order not found.");

    await releaseOrderInventory(tx, existing.items, stageFromExisting(existing), actor, existing.orderNumber);

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

    await recalculateCustomerStats(tx, existing.customerId);
    await recalculateAffiliateMetrics(tx, existing.affiliateId);
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
