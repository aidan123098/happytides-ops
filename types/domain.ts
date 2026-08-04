export type RoleName =
  | "OWNER"
  | "OPERATIONS_ADMIN"
  | "SALES"
  | "WAREHOUSE"
  | "FINANCE"
  | "ADMIN"
  | "STAFF"
  | "VIEWER"
  | "WHOLESALE_PORTAL";

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  peptideType: string;
  strengthLabel: string;
  priceCents: number;
  costOfGoodsCents: number;
  marginPercent: number;
  active: boolean;
  colorAccent: string;
  description: string;
  coaUrl: string;
  researchUseDisclaimer: string;
  imageUrl: string;
  inventoryTrackingEnabled: boolean;
  unitsSoldToday: number;
  unitsSoldWeek: number;
  revenueWeekCents: number;
};

export type InventoryBatch = {
  id: string;
  productId: string;
  productName: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantitySold: number;
  reorderThreshold: number | null;
  batchNumber: string;
  lotNumber: string;
  expirationDate: string;
  supplier: string;
  costPerVialCents: number;
  storageRequirements: string;
  coaDocumentUrl: string;
  status: "available" | "reserved" | "sold" | "expired" | "quarantined" | "damaged";
};

export type InventoryMovement = {
  id: string;
  product: string;
  batch: string;
  type: string;
  delta: number;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  referenceType?: string | null;
  reason: string;
  staff: string;
  at: string;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  customerType: "consumer" | "wholesaler";
  smsConsent: boolean;
  emailConsent: boolean;
  firstPurchaseAt: string;
  lastPurchaseAt: string;
  totalSpendCents: number;
  orderCount: number;
  averageOrderValueCents: number;
  favoriteProduct: string;
  notes: string;
  tags: string[];
  source: "walk-in" | "referral" | "event" | "Instagram" | "website" | "other";
  status: "new" | "returning" | "VIP" | "inactive";
  shippingAddress?: ShippingAddress;
};

export type ShippingAddress = {
  recipientName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: "US";
  phone?: string;
  email?: string;
  residential: boolean;
};

export type ShippingLabelSummary = {
  id: string;
  status: "draft" | "purchasing" | "completed" | "in_transit" | "delivered" | "exception" | "void_pending" | "voided" | "error" | "reconciling";
  carrierCode?: string;
  serviceName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  trackingStatus: string;
  postageCostCents?: number;
  createdAt: string;
};

export type OrderStage = "unfulfilled" | "paid" | "packed" | "shipped" | "delivered";

export type PaymentRecipient = "imran" | "dan" | "jeremy" | "aidan";

export type Order = {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  affiliateId?: string;
  affiliateName?: string;
  staffMember: string;
  location: string;
  items: Array<{
    productId?: string;
    inventoryBatchId?: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    batchNumber: string;
    lotNumber: string;
  }>;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  paymentMethod: "Processor" | "Shopify" | "Cash" | "Zelle" | "Venmo" | "ACH" | "Crypto" | "Other";
  paidTo?: PaymentRecipient;
  squarePaymentId?: string;
  squareOrderId?: string;
  shopifyOrderId?: string;
  paymentStatus: "paid" | "pending" | "refunded" | "canceled";
  fulfillmentStatus: "unfulfilled" | "packed" | "shipped" | "delivered" | "fulfilled" | "canceled";
  status: OrderStage;
  deliveryMethod: "ship" | "pickup";
  shippingAddress?: ShippingAddress;
  shippingLabel?: ShippingLabelSummary;
  createdAt: string;
  notes?: string;
};

export type ShippingConfig = {
  enabled: boolean;
  configured: boolean;
  apiConnected: boolean;
  webhookConfigured: boolean;
  warehouseId?: string;
  enabledCarrierIds: string[];
  defaultPackageCode: string;
  defaultWeightOz?: number;
  defaultLengthIn?: number;
  defaultWidthIn?: number;
  defaultHeightIn?: number;
  labelFormat: "pdf";
  labelLayout: "4x6";
};

export type ShippingRate = {
  id: string;
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
  amountCents: number;
  currency: string;
  purchasable: boolean;
  purchaseBlockReason?: string;
  deliveryDays?: number;
  estimatedDeliveryAt?: string;
};

export type RevenuePoint = {
  label: string;
  revenue: number;
  orders: number;
  units: number;
};

export type Affiliate = {
  id: string;
  name: string;
  code: string;
  affiliateType: "online" | "wholesale" | "influencer";
  status: "N/A" | "active" | "paused" | "pending" | "declined";
  revenueGeneratedCents: number | null;
  payoutRatePercent: number | null;
  totalPayoutCents: number | null;
  payoutDueCents: number | null;
  referredCustomers: number | null;
  referredOrders: number | null;
  lastPayoutAt: string;
  notes: string;
};

export type AffiliateOrderDetail = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  productNetCents: number;
  createdAt: string;
};

export type AffiliateActivityDetail = {
  id: string;
  action: string;
  actorName: string;
  detail: string;
  amountCents?: number;
  createdAt: string;
};

export type AffiliateDetail = {
  orders: AffiliateOrderDetail[];
  activity: AffiliateActivityDetail[];
};
