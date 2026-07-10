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
};

export type OrderStage = "unfulfilled" | "paid" | "packed" | "shipped" | "delivered";

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
  totalCents: number;
  paymentMethod: "Processor" | "Cash" | "Zelle" | "Venmo" | "ACH" | "Crypto" | "Other";
  squarePaymentId?: string;
  squareOrderId?: string;
  paymentStatus: "paid" | "pending" | "refunded" | "canceled";
  fulfillmentStatus: "unfulfilled" | "packed" | "shipped" | "delivered" | "fulfilled" | "canceled";
  status: OrderStage;
  createdAt: string;
  notes?: string;
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
  status: "N/A" | "active" | "paused" | "pending";
  revenueGeneratedCents: number | null;
  payoutRatePercent: number | null;
  totalPayoutCents: number | null;
  payoutDueCents: number | null;
  referredCustomers: number | null;
  referredOrders: number | null;
  lastPayoutAt: string;
  notes: string;
};
