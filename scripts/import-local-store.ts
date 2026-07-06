import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { CustomerSource, CustomerStatus, FulfillmentStatus, InventoryStatus, PaymentMethod, PaymentStatus, PrismaClient } from "@prisma/client";
import type { Affiliate, Customer, InventoryBatch, Order, Product } from "@/types/domain";

type LocalStore = {
  affiliates?: Affiliate[];
  customers?: Customer[];
  inventoryBatches?: InventoryBatch[];
  orders?: Order[];
  products?: Product[];
};

const prisma = new PrismaClient();
const write = process.argv.includes("--write");
const storePath = join(process.cwd(), ".happytides-local-store.json");

const sourceMap: Record<Customer["source"], CustomerSource> = {
  "walk-in": CustomerSource.WALK_IN,
  referral: CustomerSource.REFERRAL,
  event: CustomerSource.EVENT,
  Instagram: CustomerSource.INSTAGRAM,
  website: CustomerSource.WEBSITE,
  other: CustomerSource.OTHER
};

const customerStatusMap: Record<Customer["status"], CustomerStatus> = {
  new: CustomerStatus.NEW,
  returning: CustomerStatus.RETURNING,
  VIP: CustomerStatus.VIP,
  inactive: CustomerStatus.INACTIVE
};

const inventoryStatusMap: Record<InventoryBatch["status"], InventoryStatus> = {
  available: InventoryStatus.AVAILABLE,
  reserved: InventoryStatus.RESERVED,
  sold: InventoryStatus.SOLD,
  expired: InventoryStatus.EXPIRED,
  quarantined: InventoryStatus.QUARANTINED,
  damaged: InventoryStatus.DAMAGED
};

const paymentMethodMap: Record<Order["paymentMethod"], PaymentMethod> = {
  Processor: PaymentMethod.SQUARE_CARD,
  Cash: PaymentMethod.CASH,
  Zelle: PaymentMethod.ZELLE,
  Venmo: PaymentMethod.VENMO,
  ACH: PaymentMethod.ACH,
  Crypto: PaymentMethod.OTHER,
  Other: PaymentMethod.OTHER
};

const paymentStatusMap: Record<Order["paymentStatus"], PaymentStatus> = {
  paid: PaymentStatus.PAID,
  pending: PaymentStatus.PENDING,
  refunded: PaymentStatus.REFUNDED,
  canceled: PaymentStatus.CANCELED
};

const fulfillmentStatusMap: Record<Order["fulfillmentStatus"], FulfillmentStatus> = {
  fulfilled: FulfillmentStatus.FULFILLED,
  unfulfilled: FulfillmentStatus.UNFULFILLED,
  canceled: FulfillmentStatus.CANCELED
};

function dateOrFallback(value: string, fallback: string) {
  return value === "N/A" ? new Date(fallback) : new Date(`${value}T00:00:00.000Z`);
}

async function main() {
  if (!existsSync(storePath)) {
    console.log(JSON.stringify({ dryRun: !write, error: "No .happytides-local-store.json found." }, null, 2));
    return;
  }

  const store = JSON.parse(readFileSync(storePath, "utf8")) as LocalStore;
  const report = {
    dryRun: !write,
    products: store.products?.length ?? 0,
    customers: store.customers?.length ?? 0,
    inventoryBatches: store.inventoryBatches?.length ?? 0,
    affiliates: store.affiliates?.length ?? 0,
    orders: store.orders?.filter((order) => order.orderNumber !== "N/A").length ?? 0,
    skippedOrders: [] as string[]
  };

  if (!write) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const product of store.products ?? []) {
      const category = await tx.productCategory.upsert({
        where: { name: product.category },
        update: {},
        create: { name: product.category }
      });

      await tx.product.upsert({
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
          coaUrl: product.coaUrl === "N/A" ? null : product.coaUrl,
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
          coaUrl: product.coaUrl === "N/A" ? null : product.coaUrl,
          researchUseDisclaimer: product.researchUseDisclaimer,
          imageUrl: product.imageUrl,
          inventoryTrackingEnabled: product.inventoryTrackingEnabled
        }
      });
    }

    for (const customer of store.customers ?? []) {
      await tx.customer.upsert({
        where: { id: customer.id },
        update: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email === "N/A" ? null : customer.email,
          phone: customer.phone === "N/A" ? null : customer.phone,
          smsConsent: customer.smsConsent,
          emailConsent: customer.emailConsent,
          source: sourceMap[customer.source],
          status: customerStatusMap[customer.status],
          notes: customer.notes === "N/A" ? null : customer.notes
        },
        create: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email === "N/A" ? null : customer.email,
          phone: customer.phone === "N/A" ? null : customer.phone,
          smsConsent: customer.smsConsent,
          emailConsent: customer.emailConsent,
          source: sourceMap[customer.source],
          status: customerStatusMap[customer.status],
          notes: customer.notes === "N/A" ? null : customer.notes
        }
      });
    }

    for (const batch of store.inventoryBatches ?? []) {
      await tx.inventoryBatch.upsert({
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
          expirationDate: dateOrFallback(batch.expirationDate, "2099-12-31T00:00:00.000Z"),
          supplier: batch.supplier,
          costPerVialCents: batch.costPerVialCents,
          storageRequirements: batch.storageRequirements,
          coaDocumentUrl: batch.coaDocumentUrl === "N/A" ? null : batch.coaDocumentUrl,
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
          expirationDate: dateOrFallback(batch.expirationDate, "2099-12-31T00:00:00.000Z"),
          supplier: batch.supplier,
          costPerVialCents: batch.costPerVialCents,
          storageRequirements: batch.storageRequirements,
          coaDocumentUrl: batch.coaDocumentUrl === "N/A" ? null : batch.coaDocumentUrl,
          status: inventoryStatusMap[batch.status]
        }
      });
    }

    for (const affiliate of store.affiliates ?? []) {
      if (affiliate.id === "aff_placeholder") continue;
      await tx.affiliate.upsert({
        where: { id: affiliate.id },
        update: {
          name: affiliate.name === "N/A" ? null : affiliate.name,
          code: affiliate.code === "N/A" ? null : affiliate.code,
          status: affiliate.status === "N/A" ? "pending" : affiliate.status,
          revenueGeneratedCents: affiliate.revenueGeneratedCents ?? 0,
          payoutRateBps: Math.round((affiliate.payoutRatePercent ?? 0) * 100),
          totalPayoutCents: affiliate.totalPayoutCents ?? 0,
          payoutDueCents: affiliate.payoutDueCents ?? 0,
          referredCustomers: affiliate.referredCustomers ?? 0,
          referredOrders: affiliate.referredOrders ?? 0
        },
        create: {
          id: affiliate.id,
          name: affiliate.name === "N/A" ? null : affiliate.name,
          code: affiliate.code === "N/A" ? null : affiliate.code,
          status: affiliate.status === "N/A" ? "pending" : affiliate.status,
          revenueGeneratedCents: affiliate.revenueGeneratedCents ?? 0,
          payoutRateBps: Math.round((affiliate.payoutRatePercent ?? 0) * 100),
          totalPayoutCents: affiliate.totalPayoutCents ?? 0,
          payoutDueCents: affiliate.payoutDueCents ?? 0,
          referredCustomers: affiliate.referredCustomers ?? 0,
          referredOrders: affiliate.referredOrders ?? 0
        }
      });
    }

    const owner = await tx.user.findFirst({ where: { roles: { some: { role: { name: "OWNER" } } } } });
    if (!owner) {
      report.skippedOrders.push("all: no OWNER user exists to assign imported orders");
      return;
    }

    for (const order of store.orders?.filter((item) => item.orderNumber !== "N/A") ?? []) {
      const customerId = order.customerId ?? "cust_placeholder";
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        report.skippedOrders.push(`${order.orderNumber}: missing customer ${customerId}`);
        continue;
      }

      await tx.order.upsert({
        where: { orderNumber: order.orderNumber },
        update: {},
        create: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerId,
          staffMemberId: owner.id,
          subtotalCents: order.subtotalCents,
          discountCents: order.discountCents,
          taxCents: order.taxCents,
          totalCents: order.totalCents,
          paymentStatus: paymentStatusMap[order.paymentStatus],
          fulfillmentStatus: fulfillmentStatusMap[order.fulfillmentStatus],
          orderSource: order.location,
          notes: order.notes,
          items: {
            create: order.items
              .filter((item) => item.productId)
              .map((item) => ({
                productId: item.productId as string,
                inventoryBatchId: item.inventoryBatchId,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
                totalCents: item.unitPriceCents * item.quantity
              }))
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
  });

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
