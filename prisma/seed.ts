import {
  CustomerSource,
  CustomerStatus,
  FulfillmentStatus,
  InventoryStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  RoleName
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { affiliates, customers, inventoryBatches, orders, products } from "../lib/seed-data";

const prisma = new PrismaClient();

const customerSourceMap = {
  "walk-in": CustomerSource.WALK_IN,
  referral: CustomerSource.REFERRAL,
  event: CustomerSource.EVENT,
  Instagram: CustomerSource.INSTAGRAM,
  website: CustomerSource.WEBSITE,
  other: CustomerSource.OTHER
} as const;

const customerStatusMap = {
  new: CustomerStatus.NEW,
  returning: CustomerStatus.RETURNING,
  VIP: CustomerStatus.VIP,
  inactive: CustomerStatus.INACTIVE
} as const;

const paymentMethodMap = {
  Processor: PaymentMethod.SQUARE_CARD,
  Cash: PaymentMethod.CASH,
  Zelle: PaymentMethod.ZELLE,
  Venmo: PaymentMethod.VENMO,
  ACH: PaymentMethod.ACH,
  Crypto: PaymentMethod.OTHER,
  Other: PaymentMethod.OTHER
} as const;

const inventoryStatusMap = {
  available: InventoryStatus.AVAILABLE,
  reserved: InventoryStatus.RESERVED,
  sold: InventoryStatus.SOLD,
  expired: InventoryStatus.EXPIRED,
  quarantined: InventoryStatus.QUARANTINED,
  damaged: InventoryStatus.DAMAGED
} as const;

const paymentStatusMap = {
  paid: PaymentStatus.PAID,
  pending: PaymentStatus.PENDING,
  refunded: PaymentStatus.REFUNDED,
  canceled: PaymentStatus.CANCELED
} as const;

const fulfillmentStatusMap = {
  fulfilled: FulfillmentStatus.FULFILLED,
  unfulfilled: FulfillmentStatus.UNFULFILLED,
  packed: FulfillmentStatus.PACKED,
  shipped: FulfillmentStatus.PACKED,
  delivered: FulfillmentStatus.FULFILLED,
  canceled: FulfillmentStatus.CANCELED
} as const;

async function main() {
  const roles = [
    { name: RoleName.OWNER, description: "Full access to operations, reporting, settings, and security." },
    { name: RoleName.OPERATIONS_ADMIN, description: "Manage products, inventory, customers, orders, integrations, and reports." },
    { name: RoleName.SALES, description: "Manage accounts, contacts, quotes, and orders." },
    { name: RoleName.WAREHOUSE, description: "Manage receiving, inventory, picking, packing, and fulfillment." },
    { name: RoleName.FINANCE, description: "Manage payments, refunds, reconciliation, and finance reporting." },
    { name: RoleName.VIEWER, description: "Read-only dashboard and report access." },
    { name: RoleName.WHOLESALE_PORTAL, description: "Future customer portal access." },
    { name: RoleName.ADMIN, description: "Legacy admin role retained for migration compatibility." },
    { name: RoleName.STAFF, description: "Legacy staff role retained for migration compatibility." }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role
    });
  }

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.OWNER } });
  const seedOwnerEmail = process.env.DEV_SEED_OWNER_EMAIL?.trim().toLowerCase();
  const seedOwnerPassword = process.env.DEV_SEED_OWNER_PASSWORD;
  let owner = await prisma.user.findFirst({ where: { roles: { some: { role: { name: RoleName.OWNER } } } } });

  if (seedOwnerEmail && seedOwnerPassword) {
    owner = await prisma.user.upsert({
      where: { email: seedOwnerEmail },
      update: {
        name: seedOwnerEmail,
        displayName: "Owner",
        passwordHash: await bcrypt.hash(seedOwnerPassword, 12),
        active: true,
        status: "ACTIVE"
      },
      create: {
        name: seedOwnerEmail,
        displayName: "Owner",
        email: seedOwnerEmail,
        passwordHash: await bcrypt.hash(seedOwnerPassword, 12),
        roles: { create: { roleId: ownerRole.id } }
      }
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: owner.id, roleId: ownerRole.id }
    });
  }

  if (!owner) {
    throw new Error("Set DEV_SEED_OWNER_EMAIL and DEV_SEED_OWNER_PASSWORD to seed the first owner user.");
  }

  await prisma.staffLocation.upsert({
    where: { id: "loc_tribeca" },
    update: { name: "Tribeca Studio", type: "studio", active: true },
    create: { id: "loc_tribeca", name: "Tribeca Studio", type: "studio", active: true }
  });

  for (const affiliate of affiliates) {
    await prisma.affiliate.upsert({
      where: { id: affiliate.id },
      update: {
        name: affiliate.name === "N/A" ? null : affiliate.name,
        code: affiliate.code === "N/A" ? null : affiliate.code,
        status: affiliate.status.toLowerCase(),
        revenueGeneratedCents: affiliate.revenueGeneratedCents ?? 0,
        payoutRateBps: affiliate.payoutRatePercent ? Math.round(affiliate.payoutRatePercent * 100) : 0,
        totalPayoutCents: affiliate.totalPayoutCents ?? 0,
        payoutDueCents: affiliate.payoutDueCents ?? 0,
        referredCustomers: affiliate.referredCustomers ?? 0,
        referredOrders: affiliate.referredOrders ?? 0,
        lastPayoutAt: affiliate.lastPayoutAt === "N/A" ? null : new Date(affiliate.lastPayoutAt),
        notes: affiliate.notes === "N/A" ? null : affiliate.notes
      },
      create: {
        id: affiliate.id,
        name: affiliate.name === "N/A" ? null : affiliate.name,
        code: affiliate.code === "N/A" ? null : affiliate.code,
        status: affiliate.status.toLowerCase(),
        revenueGeneratedCents: affiliate.revenueGeneratedCents ?? 0,
        payoutRateBps: affiliate.payoutRatePercent ? Math.round(affiliate.payoutRatePercent * 100) : 0,
        totalPayoutCents: affiliate.totalPayoutCents ?? 0,
        payoutDueCents: affiliate.payoutDueCents ?? 0,
        referredCustomers: affiliate.referredCustomers ?? 0,
        referredOrders: affiliate.referredOrders ?? 0,
        lastPayoutAt: affiliate.lastPayoutAt === "N/A" ? null : new Date(affiliate.lastPayoutAt),
        notes: affiliate.notes === "N/A" ? null : affiliate.notes
      }
    });
  }
  await prisma.staffLocation.upsert({
    where: { id: "loc_soho_event" },
    update: { name: "SoHo Private Event", type: "event", active: true },
    create: { id: "loc_soho_event", name: "SoHo Private Event", type: "event", active: true }
  });

  const categoryNames = Array.from(new Set(products.map((product) => product.category)));
  for (const categoryName of categoryNames) {
    await prisma.productCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName, description: `${categoryName} catalog grouping.` }
    });
  }

  for (const product of products) {
    const category = await prisma.productCategory.findUniqueOrThrow({ where: { name: product.category } });
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        categoryId: category.id,
        peptideType: product.peptideType,
        strengthLabel: product.strengthLabel,
        priceCents: product.priceCents,
        costOfGoodsCents: product.costOfGoodsCents,
        active: product.active,
        colorAccent: product.colorAccent,
        description: product.description,
        coaUrl: product.coaUrl,
        researchUseDisclaimer: product.researchUseDisclaimer,
        imageUrl: product.imageUrl,
        inventoryTrackingEnabled: product.inventoryTrackingEnabled
      },
      create: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        categoryId: category.id,
        peptideType: product.peptideType,
        strengthLabel: product.strengthLabel,
        priceCents: product.priceCents,
        costOfGoodsCents: product.costOfGoodsCents,
        active: product.active,
        colorAccent: product.colorAccent,
        description: product.description,
        coaUrl: product.coaUrl,
        researchUseDisclaimer: product.researchUseDisclaimer,
        imageUrl: product.imageUrl,
        inventoryTrackingEnabled: product.inventoryTrackingEnabled
      }
    });
  }

  for (const batch of inventoryBatches) {
    await prisma.inventoryBatch.upsert({
      where: {
        productId_batchNumber_lotNumber: {
          productId: batch.productId,
          batchNumber: batch.batchNumber,
          lotNumber: batch.lotNumber
        }
      },
      update: {
        quantityOnHand: batch.quantityOnHand,
        quantityReserved: batch.quantityReserved,
        quantitySold: batch.quantitySold,
        reorderThreshold: batch.reorderThreshold ?? 0,
        expirationDate: batch.expirationDate === "N/A" ? new Date("2099-12-31T00:00:00.000Z") : new Date(`${batch.expirationDate}T00:00:00.000Z`),
        supplier: batch.supplier,
        costPerVialCents: batch.costPerVialCents,
        storageRequirements: batch.storageRequirements,
        coaDocumentUrl: batch.coaDocumentUrl,
        status: inventoryStatusMap[batch.status]
      },
      create: {
        id: batch.id,
        productId: batch.productId,
        quantityOnHand: batch.quantityOnHand,
        quantityReserved: batch.quantityReserved,
        quantitySold: batch.quantitySold,
        reorderThreshold: batch.reorderThreshold ?? 0,
        batchNumber: batch.batchNumber,
        lotNumber: batch.lotNumber,
        expirationDate: batch.expirationDate === "N/A" ? new Date("2099-12-31T00:00:00.000Z") : new Date(`${batch.expirationDate}T00:00:00.000Z`),
        supplier: batch.supplier,
        costPerVialCents: batch.costPerVialCents,
        storageRequirements: batch.storageRequirements,
        coaDocumentUrl: batch.coaDocumentUrl,
        status: inventoryStatusMap[batch.status]
      }
    });
  }

  for (const customer of customers) {
    const favorite = products.find((product) => product.name === customer.favoriteProduct);
    const firstPurchaseAt = customer.firstPurchaseAt === "N/A" ? null : new Date(`${customer.firstPurchaseAt}T00:00:00.000Z`);
    const lastPurchaseAt = customer.lastPurchaseAt === "N/A" ? null : new Date(`${customer.lastPurchaseAt}T00:00:00.000Z`);
    await prisma.customer.upsert({
      where: { email: customer.email },
      update: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        smsConsent: customer.smsConsent,
        emailConsent: customer.emailConsent,
        firstPurchaseAt,
        lastPurchaseAt,
        totalSpendCents: customer.totalSpendCents,
        orderCount: customer.orderCount,
        averageOrderValueCents: customer.averageOrderValueCents,
        favoriteProductId: favorite?.id,
        notes: customer.notes,
        source: customerSourceMap[customer.source],
        status: customerStatusMap[customer.status]
      },
      create: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        smsConsent: customer.smsConsent,
        emailConsent: customer.emailConsent,
        firstPurchaseAt,
        lastPurchaseAt,
        totalSpendCents: customer.totalSpendCents,
        orderCount: customer.orderCount,
        averageOrderValueCents: customer.averageOrderValueCents,
        favoriteProductId: favorite?.id,
        notes: customer.notes,
        source: customerSourceMap[customer.source],
        status: customerStatusMap[customer.status]
      }
    });
  }

  for (const order of orders) {
    if (order.orderNumber === "N/A") {
      continue;
    }

    const [firstName, lastName] = order.customerName.split(" ");
    const customer = await prisma.customer.findFirstOrThrow({ where: { firstName, lastName } });
    const location = await prisma.staffLocation.findFirst({ where: { name: order.location } });
    await prisma.order.upsert({
      where: { orderNumber: order.orderNumber },
      update: {
        totalCents: order.totalCents,
        paymentStatus: paymentStatusMap[order.paymentStatus],
        fulfillmentStatus: fulfillmentStatusMap[order.fulfillmentStatus]
      },
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: customer.id,
        staffMemberId: owner.id,
        locationId: location?.id,
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        paymentStatus: paymentStatusMap[order.paymentStatus],
        fulfillmentStatus: fulfillmentStatusMap[order.fulfillmentStatus],
        squareOrderId: order.squareOrderId,
        notes: order.notes,
        items: {
          create: order.items.map((item) => {
            const product = products.find((candidate) => candidate.name === item.productName);
            const batch = inventoryBatches.find((candidate) => candidate.batchNumber === item.batchNumber);

            if (!product || !batch) {
              throw new Error(`Missing seed product or batch for ${item.productName}`);
            }

            return {
              productId: product.id,
              inventoryBatchId: batch.id,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              discountCents: 0,
              taxCents: 0,
              totalCents: item.quantity * item.unitPriceCents
            };
          })
        },
        payments: {
          create: {
            method: paymentMethodMap[order.paymentMethod],
            status: paymentStatusMap[order.paymentStatus],
            amountCents: order.totalCents,
            squarePaymentId: order.squarePaymentId,
            paidAt: new Date(order.createdAt)
          }
        }
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
