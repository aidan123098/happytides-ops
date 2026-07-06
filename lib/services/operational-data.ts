import type { CustomerSource, CustomerStatus, FulfillmentStatus, InventoryStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
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
  PACKED: "unfulfilled",
  PARTIALLY_FULFILLED: "unfulfilled",
  FULFILLED: "fulfilled",
  CANCELED: "canceled"
};

function isoOrNA(date: Date | null | undefined) {
  return date ? date.toISOString() : "N/A";
}

function productToDomain(product: Awaited<ReturnType<typeof prisma.product.findMany>>[number] & { category?: { name: string } | null }): Product {
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

export async function getProducts() {
  const products = await prisma.product.findMany({
    where: { archivedAt: null },
    include: { category: true },
    orderBy: { name: "asc" }
  });

  return products.map(productToDomain);
}

export async function getInventoryBatches() {
  const batches = await prisma.inventoryBatch.findMany({
    where: { archivedAt: null },
    include: { product: true },
    orderBy: [{ product: { name: "asc" } }, { expirationDate: "asc" }]
  });

  return batches.map((batch): InventoryBatch => ({
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
  }));
}

export async function getInventoryMovements() {
  const movements = await prisma.inventoryMovement.findMany({
    include: {
      batch: { include: { product: true } },
      adjustedBy: true
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return movements.map((movement) => ({
    id: movement.id,
    product: movement.batch.product.name,
    batch: `${movement.batch.batchNumber}/${movement.batch.lotNumber}`,
    type: movement.type.toLowerCase(),
    delta: movement.quantityDelta,
    reason: movement.reason,
    staff: movement.adjustedBy.displayName || movement.adjustedBy.name,
    at: movement.createdAt.toISOString()
  }));
}

export async function getCustomers() {
  const customers = await prisma.customer.findMany({
    where: { archivedAt: null },
    include: {
      favoriteProduct: true,
      tags: { include: { tag: true } }
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
  });

  return customers.map((customer): Customer => ({
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
  }));
}

export async function getAffiliates() {
  const affiliates = await prisma.affiliate.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" }
  });

  return affiliates.map((affiliate): Affiliate => ({
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
  }));
}

export async function getOrders() {
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

  return orders.map((order): Order => {
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
      fulfillmentStatus: fulfillmentStatusMap[order.fulfillmentStatus] ?? "unfulfilled",
      createdAt: order.createdAt.toISOString(),
      notes: order.notes ?? undefined
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
