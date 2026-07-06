import type { Affiliate, Customer, InventoryBatch, Order, Product, RevenuePoint } from "@/types/domain";

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export const products: Product[] = [
  {
    id: "prod_bpc_157_10",
    name: "BPC-157 10 mg",
    sku: "BC10",
    category: "Recovery Research",
    peptideType: "Synthetic pentadecapeptide",
    strengthLabel: "10 mg",
    priceCents: 4000,
    costOfGoodsCents: 950,
    marginPercent: 76.3,
    active: true,
    colorAccent: "#0f766e",
    description: "Research-use product tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-teal.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_tb_500_10",
    name: "TB-500 10 mg",
    sku: "BT10",
    category: "Recovery Research",
    peptideType: "Thymosin beta-4 research peptide",
    strengthLabel: "10 mg",
    priceCents: 4500,
    costOfGoodsCents: 1600,
    marginPercent: 64.4,
    active: true,
    colorAccent: "#2563eb",
    description: "Research-use product tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-blue.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_cjc_1295_no_dac_10",
    name: "CJC-1295 No DAC 10 mg",
    sku: "CND10",
    category: "Performance Research",
    peptideType: "GHRH analog research peptide",
    strengthLabel: "10 mg",
    priceCents: 3500,
    costOfGoodsCents: 1550,
    marginPercent: 55.7,
    active: true,
    colorAccent: "#475569",
    description: "Research-use product tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-slate.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_tesamorelin_10",
    name: "Tesamorelin 10 mg",
    sku: "TSM10",
    category: "Metabolic Research",
    peptideType: "GHRH analog research peptide",
    strengthLabel: "10 mg",
    priceCents: 8500,
    costOfGoodsCents: 1800,
    marginPercent: 78.8,
    active: true,
    colorAccent: "#0369a1",
    description: "Research-use product tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-sky.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_ghk_cu_50",
    name: "GHK-Cu 50 mg",
    sku: "CU50",
    category: "Cosmetic Research",
    peptideType: "Copper tripeptide",
    strengthLabel: "50 mg",
    priceCents: 3500,
    costOfGoodsCents: 700,
    marginPercent: 80.0,
    active: true,
    colorAccent: "#b45309",
    description: "Research-use product tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-copper.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_mots_c_10",
    name: "MOTS-C 10 mg",
    sku: "MS10",
    category: "Longevity Research",
    peptideType: "Mitochondrial-derived research peptide",
    strengthLabel: "10 mg",
    priceCents: 5000,
    costOfGoodsCents: 900,
    marginPercent: 82.0,
    active: true,
    colorAccent: "#0891b2",
    description: "Research-use product tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-cyan.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_glp3_rt_10",
    name: "GLP3-RT 10 mg",
    sku: "RT10",
    category: "Metabolic Research",
    peptideType: "GLP analog research peptide",
    strengthLabel: "10 mg",
    priceCents: 8500,
    costOfGoodsCents: 1200,
    marginPercent: 85.9,
    active: true,
    colorAccent: "#7c3aed",
    description: "Research-use product tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-violet.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_nad_500",
    name: "NAD+ 500 mg",
    sku: "NJ500",
    category: "Longevity Research",
    peptideType: "Nucleotide coenzyme research compound",
    strengthLabel: "500 mg",
    priceCents: 5000,
    costOfGoodsCents: 1100,
    marginPercent: 78.0,
    active: true,
    colorAccent: "#155e75",
    description: "Research-use product tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-cyan.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_glow_blend",
    name: "GLOW Blend",
    sku: "BBG70",
    category: "Blend Research",
    peptideType: "BPC-157 10 mg / TB-500 10 mg / GHK-Cu 50 mg blend",
    strengthLabel: "70 mg blend",
    priceCents: 11500,
    costOfGoodsCents: 2100,
    marginPercent: 81.7,
    active: true,
    colorAccent: "#db2777",
    description: "Research-use blend tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-copper.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_klow_blend",
    name: "KLOW Blend",
    sku: "KL80",
    category: "Blend Research",
    peptideType: "BPC-157 10 mg / TB-500 10 mg / GHK-Cu 50 mg / KPV 10 mg blend",
    strengthLabel: "80 mg blend",
    priceCents: 13000,
    costOfGoodsCents: 2300,
    marginPercent: 82.3,
    active: true,
    colorAccent: "#111827",
    description: "Research-use blend tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-slate.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  },
  {
    id: "prod_bac_water_30",
    name: "BAC Water 30 ml",
    sku: "BAC30",
    category: "Supplies",
    peptideType: "Bacteriostatic water",
    strengthLabel: "30 ml",
    priceCents: 2000,
    costOfGoodsCents: 0,
    marginPercent: 100.0,
    active: true,
    colorAccent: "#64748b",
    description: "Research-use supply tracked by SKU, batch, and inventory count.",
    coaUrl: "N/A",
    researchUseDisclaimer: "For research use only. Not for human or veterinary use.",
    imageUrl: "/product-vial-slate.png",
    inventoryTrackingEnabled: true,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  }
];

export const inventoryBatches: InventoryBatch[] = [
  {
    id: "batch_bc10",
    productId: "prod_bpc_157_10",
    productName: "BPC-157 10 mg",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 950,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_bt10",
    productId: "prod_tb_500_10",
    productName: "TB-500 10 mg",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 1600,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_cnd10",
    productId: "prod_cjc_1295_no_dac_10",
    productName: "CJC-1295 No DAC 10 mg",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 1550,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_tsm10",
    productId: "prod_tesamorelin_10",
    productName: "Tesamorelin 10 mg",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 1800,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_cu50",
    productId: "prod_ghk_cu_50",
    productName: "GHK-Cu 50 mg",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 700,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_ms10",
    productId: "prod_mots_c_10",
    productName: "MOTS-C 10 mg",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 900,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_rt10",
    productId: "prod_glp3_rt_10",
    productName: "GLP3-RT 10 mg",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 1200,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_nj500",
    productId: "prod_nad_500",
    productName: "NAD+ 500 mg",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 1100,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_bbg70",
    productId: "prod_glow_blend",
    productName: "GLOW Blend",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 2100,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_kl80",
    productId: "prod_klow_blend",
    productName: "KLOW Blend",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 2300,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  },
  {
    id: "batch_bac30",
    productId: "prod_bac_water_30",
    productName: "BAC Water 30 ml",
    quantityOnHand: 50,
    quantityReserved: 0,
    quantitySold: 0,
    reorderThreshold: null,
    batchNumber: "N/A",
    lotNumber: "N/A",
    expirationDate: "N/A",
    supplier: "Ben",
    costPerVialCents: 0,
    storageRequirements: "N/A",
    coaDocumentUrl: "N/A",
    status: "available"
  }
];

export const customers: Customer[] = [
  {
    id: "cust_placeholder",
    firstName: "N/A",
    lastName: "",
    email: "N/A",
    phone: "N/A",
    customerType: "consumer",
    smsConsent: false,
    emailConsent: false,
    firstPurchaseAt: "N/A",
    lastPurchaseAt: "N/A",
    totalSpendCents: 0,
    orderCount: 0,
    averageOrderValueCents: 0,
    favoriteProduct: "N/A",
    notes: "N/A",
    tags: [],
    source: "event",
    status: "new"
  }
];

export const orders: Order[] = [
  {
    id: "ord_placeholder",
    orderNumber: "N/A",
    customerName: "N/A",
    staffMember: "N/A",
    location: "N/A",
    items: [
      { productName: "N/A", quantity: 0, unitPriceCents: 0, batchNumber: "N/A", lotNumber: "N/A" }
    ],
    subtotalCents: 0,
    discountCents: 0,
    taxCents: 0,
    totalCents: 0,
    paymentMethod: "Other",
    squarePaymentId: "N/A",
    squareOrderId: "N/A",
    paymentStatus: "pending",
    fulfillmentStatus: "unfulfilled",
    createdAt: "N/A",
    notes: "N/A"
  }
];

export const revenueSeries: RevenuePoint[] = [
  { label: "Mon", revenue: 0, orders: 0, units: 0 },
  { label: "Tue", revenue: 0, orders: 0, units: 0 },
  { label: "Wed", revenue: 0, orders: 0, units: 0 },
  { label: "Thu", revenue: 0, orders: 0, units: 0 },
  { label: "Fri", revenue: 0, orders: 0, units: 0 },
  { label: "Sat", revenue: 0, orders: 0, units: 0 },
  { label: "Sun", revenue: 0, orders: 0, units: 0 },
  { label: "Today", revenue: 0, orders: 0, units: 0 }
];

export const locationSales = [
  { name: "N/A", revenue: 0, orders: 0 }
];

export const inventoryMovements = [
  { id: "mov_placeholder", product: "N/A", batch: "N/A", type: "N/A", delta: 0, reason: "N/A", staff: "N/A", at: "N/A" }
];

export const affiliates: Affiliate[] = [
  {
    id: "aff_placeholder",
    name: "N/A",
    code: "N/A",
    affiliateType: "online",
    status: "N/A",
    revenueGeneratedCents: null,
    payoutRatePercent: null,
    totalPayoutCents: null,
    payoutDueCents: null,
    referredCustomers: null,
    referredOrders: null,
    lastPayoutAt: "N/A",
    notes: "N/A"
  }
];

export function getDashboardMetrics() {
  const todayOrders = orders.filter((order) => order.createdAt.startsWith("2026-06-08"));
  const revenueToday = todayOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const unitsSoldToday = todayOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
  const revenueWeek = revenueSeries.reduce((sum, point) => sum + point.revenue * 100, 0);
  const revenueMonth = 0;
  const orderCountToday = todayOrders.length;
  const aov = Math.round(revenueToday / Math.max(orderCountToday, 1));
  const repeatRate = 0;
  const lowStock = inventoryBatches.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold);
  const topToday = [...products].sort((a, b) => b.unitsSoldToday - a.unitsSoldToday)[0];
  const topWeek = [...products].sort((a, b) => b.unitsSoldWeek - a.unitsSoldWeek)[0];

  return {
    revenueToday,
    revenueWeek,
    revenueMonth,
    aov,
    orderCountToday,
    unitsSoldToday,
    topToday,
    topWeek,
    lowStock,
    repeatRate,
    newCustomers: 0,
    returningCustomers: 0
  };
}
