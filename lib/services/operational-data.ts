import {
  PaymentStatus,
  type Affiliate as PrismaAffiliate,
  type CustomerSource,
  type CustomerStatus,
  type FulfillmentStatus,
  type InventoryStatus,
  type OrderStatus,
  type PaymentMethod,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Affiliate, Customer, InventoryBatch, Order, Product } from "@/types/domain";

export type OperationalStore = {
  affiliates: Affiliate[];
  customers: Customer[];
  inventoryBatches: InventoryBatch[];
  inventoryMovements: Array<{
    id: string;
    product: string;
    batch: string;
    type: string;
    delta: number;
    reason: string;
    staff: string;
    at: string;
  }>;
  orders: Order[];
  products: Product[];
};

const readCacheTtlMs = 30 * 1000;

const globalForOperationalData = globalThis as unknown as {
  happytidesOperationalDataCache: Map<string, { expiresAt: number; value: Promise<unknown> }> | undefined;
};

const operationalDataCache = globalForOperationalData.happytidesOperationalDataCache ?? new Map<string, { expiresAt: number; value: Promise<unknown> }>();

if (process.env.NODE_ENV !== "production") {
  globalForOperationalData.happytidesOperationalDataCache = operationalDataCache;
}

function cachedRead<T>(key: string, load: () => Promise<T>, ttlMs = readCacheTtlMs) {
  const now = Date.now();
  const cached = operationalDataCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as Promise<T>;
  }

  const value = load().catch((error) => {
    operationalDataCache.delete(key);
    throw error;
  });

  operationalDataCache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

export function invalidateOperationalDataCache() {
  operationalDataCache.clear();
}

const sourceMap: Record<CustomerSource, Customer["source"]> = {
  WALK_IN: "walk-in",
  REFERRAL: "referral",
  EVENT: "event",
  INSTAGRAM: "Instagram",
  WEBSITE: "website",
  OTHER: "other"
};

const customerStatusMap: Record<CustomerStatus, Customer["status"]> = {
  NEW: "new",
  RETURNING: "returning",
  VIP: "VIP",
  INACTIVE: "inactive"
};

const inventoryStatusMap: Partial<Record<InventoryStatus, InventoryBatch["status"]>> = {
  AVAILABLE: "available",
  RECEIVED: "available",
  QA_RELEASED: "available",
  RESERVED: "reserved",
  SOLD: "sold",
  EXPIRED: "expired",
  QUARANTINED: "quarantined",
  DAMAGED: "damaged",
  ON_HOLD: "quarantined",
  RECALLED: "quarantined",
  DESTROYED: "damaged",
  ARCHIVED: "damaged"
};

const paymentMethodMap: Record<PaymentMethod, Order["paymentMethod"]> = {
  SQUARE_CARD: "Processor",
  CASH: "Cash",
  ACH: "ACH",
  WIRE: "ACH",
  ZELLE: "Zelle",
  VENMO: "Venmo",
  CHECK: "Other",
  ACCOUNT_CREDIT: "Other",
  OTHER: "Other"
};

const paymentStatusMap: Partial<Record<PaymentStatus, Order["paymentStatus"]>> = {
  PENDING: "pending",
  UNPAID: "pending",
  PARTIALLY_PAID: "pending",
  PAID: "paid",
  OVERPAID: "paid",
  FAILED: "pending",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "refunded",
  CANCELED: "canceled",
  VOIDED: "canceled"
};

const fulfillmentStatusMap: Partial<Record<FulfillmentStatus, Order["fulfillmentStatus"]>> = {
  UNFULFILLED: "unfulfilled",
  PARTIALLY_ALLOCATED: "unfulfilled",
  ALLOCATED: "unfulfilled",
  PICKING: "unfulfilled",
  PACKED: "packed",
  PARTIALLY_FULFILLED: "unfulfilled",
  FULFILLED: "delivered",
  CANCELED: "canceled"
};

const orderStageMap: Partial<Record<OrderStatus, Order["fulfillmentStatus"]>> = {
  READY_TO_SHIP: "packed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  COMPLETED: "delivered",
  CANCELED: "canceled"
};

function isoOrNA(date: Date | null | undefined) {
  return date ? date.toISOString() : "N/A";
}

type ProductWithCategory = Prisma.ProductGetPayload<{ include: { category: true } }>;
type InventoryBatchWithProduct = Prisma.InventoryBatchGetPayload<{ include: { product: true } }>;
type InventoryMovementWithRelations = Prisma.InventoryMovementGetPayload<{
  include: { batch: { include: { product: true } }; adjustedBy: true };
}>;
type CustomerWithRelations = Prisma.CustomerGetPayload<{
  include: { favoriteProduct: true; tags: { include: { tag: true } } };
}>;
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    staffMember: true;
    location: true;
    affiliate: true;
    items: { include: { product: true; inventoryBatch: true } };
    payments: true;
  };
}>;

function productToDomain(product: ProductWithCategory): Product {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category?.name ?? "Uncategorized",
    peptideType: product.peptideType,
    strengthLabel: product.strengthLabel,
    priceCents: product.priceCents,
    costOfGoodsCents: product.costOfGoodsCents,
    marginPercent: product.priceCents > 0 ? ((product.priceCents - product.costOfGoodsCents) / product.priceCents) * 100 : 0,
    active: product.active && !product.archivedAt,
    colorAccent: product.colorAccent,
    description: product.description ?? "",
    coaUrl: product.coaUrl ?? "N/A",
    researchUseDisclaimer: product.researchUseDisclaimer,
    imageUrl: product.imageUrl ?? "",
    inventoryTrackingEnabled: product.inventoryTrackingEnabled,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  };
}

function inventoryBatchToDomain(batch: InventoryBatchWithProduct): InventoryBatch {
  return {
    id: batch.id,
    productId: batch.productId,
    productName: batch.product.name,
    quantityOnHand: batch.quantityOnHand,
    quantityReserved: batch.quantityReserved,
    quantitySold: batch.quantitySold,
    reorderThreshold: batch.reorderThreshold,
    batchNumber: batch.batchNumber,
    lotNumber: batch.lotNumber,
    expirationDate: batch.expirationDate.getFullYear() >= 2099 ? "N/A" : batch.expirationDate.toISOString().slice(0, 10),
    supplier: batch.supplier,
    costPerVialCents: batch.costPerVialCents,
    storageRequirements: batch.storageRequirements,
    coaDocumentUrl: batch.coaDocumentUrl ?? "N/A",
    status: inventoryStatusMap[batch.status] ?? "quarantined"
  };
}

function inventoryMovementToDomain(movement: InventoryMovementWithRelations) {
  return {
    id: movement.id,
    product: movement.batch.product.name,
    batch: `${movement.batch.batchNumber}/${movement.batch.lotNumber}`,
    type: movement.type.toLowerCase(),
    delta: movement.quantityDelta,
    reason: movement.reason,
    staff: movement.adjustedBy.displayName || movement.adjustedBy.name,
    at: movement.createdAt.toISOString()
  };
}

function customerToDomain(customer: CustomerWithRelations): Customer {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email ?? "N/A",
    phone: customer.phone ?? "N/A",
    customerType: customer.accountId ? "wholesaler" : "consumer",
    smsConsent: customer.smsConsent,
    emailConsent: customer.emailConsent,
    firstPurchaseAt: isoOrNA(customer.firstPurchaseAt),
    lastPurchaseAt: isoOrNA(customer.lastPurchaseAt),
    totalSpendCents: customer.totalSpendCents,
    orderCount: customer.orderCount,
    averageOrderValueCents: customer.averageOrderValueCents,
    favoriteProduct: customer.favoriteProduct?.name ?? "N/A",
    notes: customer.notes ?? "N/A",
    tags: customer.tags.map((tag) => tag.tag.name),
    source: sourceMap[customer.source],
    status: customerStatusMap[customer.status]
  };
}

function affiliateToDomain(affiliate: PrismaAffiliate): Affiliate {
  return {
    id: affiliate.id,
    name: affiliate.name ?? "N/A",
    code: affiliate.code ?? "N/A",
    affiliateType: "online",
    status: affiliate.status === "archived" ? "N/A" : (affiliate.status as Affiliate["status"]),
    revenueGeneratedCents: affiliate.revenueGeneratedCents,
    payoutRatePercent: affiliate.payoutRateBps / 100,
    totalPayoutCents: affiliate.totalPayoutCents,
    payoutDueCents: affiliate.payoutDueCents,
    referredCustomers: affiliate.referredCustomers,
    referredOrders: affiliate.referredOrders,
    lastPayoutAt: isoOrNA(affiliate.lastPayoutAt),
    notes: affiliate.notes ?? "N/A"
  };
}

function orderToDomain(order: OrderWithRelations): Order {
  const payment = order.payments[0];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
    affiliateId: order.affiliateId ?? undefined,
    affiliateName: order.affiliate?.name ?? undefined,
    staffMember: order.staffMember.displayName || order.staffMember.name,
    location: order.location?.name ?? order.orderSource ?? "Manual entry",
    items: order.items.map((item) => ({
      productId: item.productId,
      inventoryBatchId: item.inventoryBatchId ?? undefined,
      productName: item.product.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      batchNumber: item.inventoryBatch?.batchNumber ?? "N/A",
      lotNumber: item.inventoryBatch?.lotNumber ?? "N/A"
    })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    paymentMethod: payment ? paymentMethodMap[payment.method] : "Other",
    squarePaymentId: payment?.squarePaymentId ?? undefined,
    squareOrderId: order.squareOrderId ?? undefined,
    paymentStatus: paymentStatusMap[order.paymentStatus] ?? "pending",
    fulfillmentStatus: orderStageMap[order.status] ?? fulfillmentStatusMap[order.fulfillmentStatus] ?? "unfulfilled",
    createdAt: order.createdAt.toISOString(),
    notes: order.notes ?? undefined
  };
}

export async function getProducts() {
  return cachedRead("products", async () => {
    const products = await prisma.product.findMany({
      where: { archivedAt: null },
      include: { category: true },
      orderBy: { name: "asc" }
    });

    return products.map(productToDomain);
  });
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true }
  });

  return product && !product.archivedAt ? productToDomain(product) : undefined;
}

export async function getInventoryBatches() {
  return cachedRead("inventory-batches", async () => {
    const batches = await prisma.inventoryBatch.findMany({
      where: { archivedAt: null },
      include: { product: true },
      orderBy: [{ product: { name: "asc" } }, { expirationDate: "asc" }]
    });

    return batches.map(inventoryBatchToDomain);
  });
}

export async function getInventoryBatchById(id: string) {
  const batch = await prisma.inventoryBatch.findUnique({
    where: { id },
    include: { product: true }
  });

  return batch && !batch.archivedAt ? inventoryBatchToDomain(batch) : undefined;
}

export async function getInventoryMovements() {
  return cachedRead("inventory-movements", async () => {
    const movements = await prisma.inventoryMovement.findMany({
      include: {
        batch: { include: { product: true } },
        adjustedBy: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return movements.map(inventoryMovementToDomain);
  });
}

export async function getCustomers() {
  return cachedRead("customers", async () => {
    const customers = await prisma.customer.findMany({
      where: { archivedAt: null },
      include: {
        favoriteProduct: true,
        tags: { include: { tag: true } }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });

    return customers.map(customerToDomain);
  });
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      favoriteProduct: true,
      tags: { include: { tag: true } }
    }
  });

  return customer && !customer.archivedAt ? customerToDomain(customer) : undefined;
}

export async function getAffiliates() {
  return cachedRead("affiliates", async () => {
    const affiliates = await prisma.affiliate.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" }
    });

    return affiliates.map(affiliateToDomain);
  });
}

export async function getAffiliateById(id: string) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id } });

  return affiliate && !affiliate.archivedAt ? affiliateToDomain(affiliate) : undefined;
}

export async function getOrders() {
  return cachedRead("orders", async () => {
    const orders = await prisma.order.findMany({
      where: { archivedAt: null },
      include: {
        customer: true,
        staffMember: true,
        location: true,
        affiliate: true,
        items: { include: { product: true, inventoryBatch: true } },
        payments: true
      },
      orderBy: { createdAt: "desc" }
    });

    return orders.map(orderToDomain);
  });
}

export async function getOrderById(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      staffMember: true,
      location: true,
      affiliate: true,
      items: { include: { product: true, inventoryBatch: true } },
      payments: true
    }
  });

  return order && !order.archivedAt ? orderToDomain(order) : undefined;
}

export async function getAnalyticsStore() {
  const [customers, inventoryBatches, orders, products] = await Promise.all([getCustomers(), getInventoryBatches(), getOrders(), getProducts()]);

  return {
    customers,
    inventoryBatches,
    orders,
    products
  };
}

export async function getShellPulse() {
  return cachedRead("shell-pulse", async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const paidTodayWhere = {
      archivedAt: null,
      paymentStatus: PaymentStatus.PAID,
      createdAt: { gte: startOfToday, lt: startOfTomorrow }
    } satisfies Prisma.OrderWhereInput;

    const [revenueToday, ordersToday, unitsToday, inventoryLevels] = await Promise.all([
      prisma.order.aggregate({
        where: paidTodayWhere,
        _sum: { totalCents: true }
      }),
      prisma.order.count({ where: paidTodayWhere }),
      prisma.orderItem.aggregate({
        where: { order: paidTodayWhere },
        _sum: { quantity: true }
      }),
      prisma.inventoryBatch.findMany({
        where: { archivedAt: null },
        select: { quantityOnHand: true, reorderThreshold: true }
      })
    ]);

    return {
      revenueTodayCents: revenueToday._sum.totalCents ?? 0,
      ordersToday,
      lowStockCount: inventoryLevels.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold).length,
      unitsToday: unitsToday._sum.quantity ?? 0
    };
  });
}

export async function getOperationalStore(): Promise<OperationalStore> {
  const [affiliates, customers, inventoryBatches, inventoryMovements, orders, products] = await Promise.all([
    getAffiliates(),
    getCustomers(),
    getInventoryBatches(),
    getInventoryMovements(),
    getOrders(),
    getProducts()
  ]);

  return {
    affiliates,
    customers,
    inventoryBatches,
    inventoryMovements,
    orders,
    products
  };
}
