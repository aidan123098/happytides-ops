import { z } from "zod";

const optionalEmailSchema = z.preprocess((value) => value === "" ? "N/A" : value, z.union([z.string().email(), z.literal("N/A")]).optional());
const optionalPhoneSchema = z.preprocess((value) => value === "" ? "N/A" : value, z.union([z.string().min(1), z.literal("N/A")]).optional());

export const productInputSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(3),
  category: z.string().min(2),
  peptideType: z.string().min(2),
  strengthLabel: z.string().min(1),
  priceCents: z.number().int().positive(),
  costOfGoodsCents: z.number().int().nonnegative(),
  active: z.boolean().default(true),
  colorAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().optional(),
  coaUrl: z.string().url().optional(),
  researchUseDisclaimer: z.string().min(10),
  imageUrl: z.string().optional(),
  inventoryTrackingEnabled: z.boolean().default(true)
});

export const productUpdateSchema = productInputSchema.partial().extend({
  productId: z.string().min(1)
});

export const customerInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  customerType: z.enum(["consumer", "wholesaler"]).default("consumer"),
  smsConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(false),
  source: z.enum(["walk-in", "referral", "event", "Instagram", "website", "other"]).default("walk-in"),
  notes: z.string().max(1000).optional(),
  status: z.enum(["new", "returning", "VIP", "inactive"]).optional(),
  tags: z.array(z.string().min(1)).optional()
});

export const customerUpdateSchema = customerInputSchema.partial().extend({
  customerId: z.string().min(1)
});

export const affiliateInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  affiliateType: z.enum(["online", "wholesale", "influencer"]).default("online"),
  status: z.enum(["active", "paused", "pending"]).default("active"),
  revenueGeneratedCents: z.number().int().nonnegative().default(0),
  payoutRatePercent: z.number().min(0).max(100).default(20),
  totalPayoutCents: z.number().int().nonnegative().default(0),
  referredCustomers: z.number().int().nonnegative().default(0),
  referredOrders: z.number().int().nonnegative().default(0),
  lastPayoutAt: z.string().optional(),
  notes: z.string().max(1000).optional()
});

export const affiliateUpdateSchema = affiliateInputSchema.partial().extend({
  affiliateId: z.string().min(1)
});

export const orderInputSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().max(160).optional(),
  affiliateId: z.string().min(1).optional(),
  locationId: z.string().optional(),
  paymentMethod: z.enum(["Processor", "Cash", "Zelle", "Venmo", "ACH", "Crypto", "Other"]),
  squarePaymentId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        inventoryBatchId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPriceCents: z.number().int().positive(),
        discountCents: z.number().int().nonnegative().default(0)
      })
    )
    .min(1),
  notes: z.string().max(1000).optional()
});

export const orderUpdateSchema = orderInputSchema.extend({
  orderId: z.string().min(1)
});

export const inventoryAdjustmentSchema = z.object({
  batchId: z.string().min(1),
  quantityDelta: z.number().int(),
  reason: z.string().min(4),
  status: z.enum(["available", "reserved", "sold", "expired", "quarantined", "damaged"]).optional()
});

export const inventoryBatchInputSchema = z.object({
  productId: z.string().min(1),
  quantityOnHand: z.number().int().nonnegative(),
  reorderThreshold: z.number().int().nonnegative().nullable().optional(),
  batchNumber: z.string().min(1),
  lotNumber: z.string().min(1),
  expirationDate: z.string().min(1),
  supplier: z.string().min(1),
  costPerVialCents: z.number().int().nonnegative(),
  storageRequirements: z.string().min(1),
  coaDocumentUrl: z.string().optional(),
  status: z.enum(["available", "reserved", "sold", "expired", "quarantined", "damaged"]).default("available"),
  reason: z.string().min(4)
});
