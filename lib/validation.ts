import { z } from "zod";
import { normalizeShopifyOrderId } from "@/lib/shopify-order";
import { paymentRecipients } from "@/lib/payment-recipients";

const orderStatusSchema = z.enum(["unfulfilled", "paid", "packed", "shipped", "delivered"]);
const paidToSchema = z.enum(paymentRecipients);

export const shippingAddressSchema = z.object({
  recipientName: z.string().trim().min(1).max(160),
  company: z.string().trim().max(160).optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  postalCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/, "Enter a valid US ZIP code."),
  country: z.literal("US").default("US"),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  residential: z.boolean().default(true)
});

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
  status: z.enum(["new", "returning", "inactive"]).optional(),
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

const orderInputBaseSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().max(160).optional(),
  affiliateId: z.string().min(1).optional(),
  locationId: z.string().optional(),
  paymentMethod: z.enum(["Processor", "Shopify", "Cash", "Zelle", "Venmo", "ACH", "Crypto", "Other"]),
  paidTo: paidToSchema.optional(),
  squarePaymentId: z.string().optional(),
  shopifyOrderId: z.string().max(255).optional(),
  status: orderStatusSchema.optional(),
  fulfillmentStatus: z.enum(["unfulfilled", "packed", "shipped", "delivered"]).optional(),
  deliveryMethod: z.enum(["ship", "pickup"]).default("ship"),
  shippingAddress: shippingAddressSchema.optional(),
  saveShippingAddress: z.boolean().default(false),
  shippingCents: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional(),
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

function requireOrderDetails(payload: { deliveryMethod: "ship" | "pickup"; shippingAddress?: unknown; shippingCents: number; paymentMethod: string; shopifyOrderId?: string }, context: z.RefinementCtx) {
  if (payload.deliveryMethod === "ship" && !payload.shippingAddress) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["shippingAddress"], message: "A complete shipping address is required." });
  }
  if (payload.deliveryMethod === "pickup" && payload.shippingCents !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["shippingCents"], message: "Local pickup cannot include a shipping charge." });
  }
  if (payload.paymentMethod === "Shopify" && !normalizeShopifyOrderId(payload.shopifyOrderId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["shopifyOrderId"], message: "Enter a valid Shopify admin order ID, GID, or order URL." });
  }
}

export const orderInputSchema = orderInputBaseSchema.superRefine(requireOrderDetails);

export const orderUpdateSchema = orderInputBaseSchema.extend({
  orderId: z.string().min(1)
}).superRefine(requireOrderDetails);

export const orderStatusUpdateSchema = z.object({
  status: orderStatusSchema
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

export const shippingConfigInputSchema = z.object({
  enabled: z.boolean(),
  warehouseId: z.string().trim().min(1),
  enabledCarrierIds: z.array(z.string().trim().min(1)).min(1),
  defaultPackageCode: z.string().trim().min(1).default("package"),
  defaultWeightOz: z.number().positive(),
  defaultLengthIn: z.number().positive(),
  defaultWidthIn: z.number().positive(),
  defaultHeightIn: z.number().positive(),
  labelFormat: z.literal("pdf").default("pdf"),
  labelLayout: z.literal("4x6").default("4x6")
});

const parcelOverrideSchema = z.object({
  packageCode: z.string().trim().min(1).default("package"),
  weightOz: z.number().positive(),
  lengthIn: z.number().positive(),
  widthIn: z.number().positive(),
  heightIn: z.number().positive()
});

export const shippingRateRequestSchema = z.object({
  orderId: z.string().min(1),
  parcel: parcelOverrideSchema.optional()
});

export const shippingLabelPurchaseSchema = z.object({
  shipmentId: z.string().min(1),
  rateId: z.string().min(1)
});
