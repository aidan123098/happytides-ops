import { affiliates as seedAffiliates, customers as seedCustomers, inventoryBatches as seedInventoryBatches, inventoryMovements as seedInventoryMovements, orders as seedOrders, products as seedProducts } from "@/lib/seed-data";
import type { SessionUser } from "@/lib/auth";
import type { Affiliate, Customer, InventoryBatch, Order, Product } from "@/types/domain";
import type { OperationalStore } from "@/lib/services/operational-data";

type OrderPayload = {
  customerId: string;
  customerName?: string;
  affiliateId?: string;
  locationId?: string;
  paymentMethod: Order["paymentMethod"];
  squarePaymentId?: string;
  items: Array<{
    productId: string;
    inventoryBatchId: string;
    quantity: number;
    unitPriceCents: number;
    discountCents: number;
  }>;
  notes?: string;
};

type InventoryMovement = OperationalStore["inventoryMovements"][number];

const globalForOfflineStore = globalThis as unknown as {
  happytidesOfflineStore: OperationalStore | undefined;
};

function initialStore(): OperationalStore {
  return {
    affiliates: seedAffiliates.map((item) => ({ ...item })),
    customers: seedCustomers.map((item) => ({ ...item, tags: [...item.tags] })),
    inventoryBatches: seedInventoryBatches.map((item) => ({ ...item })),
    inventoryMovements: seedInventoryMovements.map((item) => ({ ...item })),
    orders: seedOrders.map((item) => ({ ...item, items: item.items.map((orderItem) => ({ ...orderItem })) })),
    products: seedProducts.map((item) => ({ ...item }))
  };
}

const state: OperationalStore = globalForOfflineStore.happytidesOfflineStore ?? initialStore();

if (process.env.NODE_ENV !== "production") {
  globalForOfflineStore.happytidesOfflineStore = state;
}

export function isDatabaseUnavailable(error: unknown) {
  return error instanceof Error && error.message.includes("Can't reach database server");
}

export function getOfflineStore(): OperationalStore {
  return {
    ...state,
    orders: state.orders.filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled")
  };
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso() {
  return new Date().toISOString();
}

function visibleOrders() {
  return state.orders.filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled");
}

function recalculateProductSales() {
  for (const product of state.products) {
    product.unitsSoldToday = 0;
    product.unitsSoldWeek = 0;
    product.revenueWeekCents = 0;
  }

  for (const order of visibleOrders().filter((item) => item.paymentStatus === "paid")) {
    for (const item of order.items) {
      const product = state.products.find((candidate) => candidate.id === item.productId);
      if (!product) continue;
      product.unitsSoldToday += item.quantity;
      product.unitsSoldWeek += item.quantity;
      product.revenueWeekCents += item.quantity * item.unitPriceCents;
    }
  }
}

function recalculateCustomerStats(customerId?: string) {
  if (!customerId) return;
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer || customer.id === "cust_placeholder") return;

  const orders = visibleOrders().filter((order) => order.customerId === customerId && order.paymentStatus === "paid");
  const totalSpendCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const productCounts = new Map<string, { name: string; quantity: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      const current = productCounts.get(item.productName) ?? { name: item.productName, quantity: 0 };
      current.quantity += item.quantity;
      productCounts.set(item.productName, current);
    }
  }

  const favorite = [...productCounts.values()].sort((left, right) => right.quantity - left.quantity)[0];
  customer.totalSpendCents = totalSpendCents;
  customer.orderCount = orders.length;
  customer.averageOrderValueCents = Math.round(totalSpendCents / Math.max(orders.length, 1));
  customer.favoriteProduct = favorite?.name ?? "N/A";
  const sorted = [...orders].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  customer.firstPurchaseAt = sorted[0]?.createdAt ?? "N/A";
  customer.lastPurchaseAt = sorted[sorted.length - 1]?.createdAt ?? "N/A";
  customer.status = orders.length > 2 ? "VIP" : orders.length > 1 ? "returning" : "new";
}

function recalculateAffiliateStats(affiliateId?: string) {
  if (!affiliateId) return;
  const affiliate = state.affiliates.find((item) => item.id === affiliateId);
  if (!affiliate || affiliate.id === "aff_placeholder") return;

  const orders = visibleOrders().filter((order) => order.affiliateId === affiliateId && order.paymentStatus === "paid");
  const revenueGeneratedCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const rate = affiliate.payoutRatePercent ?? 0;
  const totalPayoutCents = affiliate.totalPayoutCents ?? 0;
  affiliate.revenueGeneratedCents = revenueGeneratedCents;
  affiliate.referredOrders = orders.length;
  affiliate.referredCustomers = new Set(orders.map((order) => order.customerId)).size;
  affiliate.payoutDueCents = Math.max(Math.round((revenueGeneratedCents * rate) / 100) - totalPayoutCents, 0);
}

function addMovement(batch: InventoryBatch, delta: number, reason: string, actor: SessionUser): InventoryMovement {
  const movement = {
    id: id("mov"),
    product: batch.productName,
    batch: `${batch.batchNumber}/${batch.lotNumber}`,
    type: "manual_adjustment",
    delta,
    reason,
    staff: actor.name,
    at: todayIso()
  };
  state.inventoryMovements.unshift(movement);
  return movement;
}

function restoreOrderInventory(order: Order, actor: SessionUser) {
  for (const item of order.items) {
    const batch = item.inventoryBatchId ? state.inventoryBatches.find((candidate) => candidate.id === item.inventoryBatchId) : undefined;
    if (!batch) continue;
    batch.quantityOnHand += item.quantity;
    batch.quantitySold = Math.max(batch.quantitySold - item.quantity, 0);
    addMovement(batch, item.quantity, `Restored from ${order.orderNumber}`, actor);
  }
}

function allocateOrderInventory(order: Order, actor: SessionUser) {
  for (const item of order.items) {
    const batch = item.inventoryBatchId ? state.inventoryBatches.find((candidate) => candidate.id === item.inventoryBatchId) : undefined;
    if (!batch) continue;
    if (batch.quantityOnHand < item.quantity) throw new Error(`${batch.productName} does not have enough inventory.`);
    batch.quantityOnHand -= item.quantity;
    batch.quantitySold += item.quantity;
    addMovement(batch, -item.quantity, `Allocated to ${order.orderNumber}`, actor);
  }
}

function buildOrder(payload: OrderPayload, actor: SessionUser, existing?: Order): Order {
  const customer = state.customers.find((item) => item.id === payload.customerId);
  const affiliate = payload.affiliateId ? state.affiliates.find((item) => item.id === payload.affiliateId) : undefined;
  const subtotalCents = payload.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const discountCents = payload.items.reduce((sum, item) => sum + item.discountCents, 0);

  return {
    id: existing?.id ?? id("ord"),
    orderNumber: existing?.orderNumber ?? `HT-${Date.now().toString().slice(-6)}`,
    customerId: payload.customerId,
    customerName: payload.customerName ?? `${customer?.firstName ?? "Walk-in"} ${customer?.lastName ?? "Customer"}`.trim(),
    affiliateId: payload.affiliateId,
    affiliateName: affiliate?.name,
    staffMember: actor.name,
    location: payload.locationId ?? "Manual entry",
    items: payload.items.map((item) => {
      const product = state.products.find((candidate) => candidate.id === item.productId);
      const batch = state.inventoryBatches.find((candidate) => candidate.id === item.inventoryBatchId);
      if (!product || !batch) throw new Error("Selected product or inventory batch was not found.");
      return {
        productId: product.id,
        inventoryBatchId: batch.id,
        productName: product.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        batchNumber: batch.batchNumber,
        lotNumber: batch.lotNumber
      };
    }),
    subtotalCents,
    discountCents,
    taxCents: 0,
    totalCents: subtotalCents - discountCents,
    paymentMethod: payload.paymentMethod,
    squarePaymentId: payload.squarePaymentId,
    paymentStatus: "paid",
    fulfillmentStatus: "fulfilled",
    createdAt: existing?.createdAt ?? todayIso(),
    notes: payload.notes
  };
}

export function createOfflineCustomer(payload: Partial<Customer>) {
  const customer: Customer = {
    id: id("cust"),
    firstName: payload.firstName ?? "",
    lastName: payload.lastName ?? "",
    email: payload.email || "N/A",
    phone: payload.phone || "N/A",
    customerType: payload.customerType ?? "consumer",
    smsConsent: payload.smsConsent ?? false,
    emailConsent: payload.emailConsent ?? false,
    firstPurchaseAt: "N/A",
    lastPurchaseAt: "N/A",
    totalSpendCents: 0,
    orderCount: 0,
    averageOrderValueCents: 0,
    favoriteProduct: "N/A",
    notes: payload.notes || "N/A",
    tags: payload.tags ?? [],
    source: payload.source ?? "walk-in",
    status: payload.status ?? "new"
  };
  state.customers.unshift(customer);
  return customer;
}

export function updateOfflineCustomer(customerId: string, payload: Partial<Customer>) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return null;
  Object.assign(customer, {
    firstName: payload.firstName ?? customer.firstName,
    lastName: payload.lastName ?? customer.lastName,
    email: payload.email ?? customer.email,
    phone: payload.phone ?? customer.phone,
    customerType: payload.customerType ?? customer.customerType,
    smsConsent: payload.smsConsent ?? customer.smsConsent,
    emailConsent: payload.emailConsent ?? customer.emailConsent,
    source: payload.source ?? customer.source,
    status: payload.status ?? customer.status,
    notes: payload.notes ?? customer.notes,
    tags: payload.tags ?? customer.tags
  });
  return customer;
}

export function deleteOfflineCustomer(customerId: string) {
  const before = state.customers.length;
  state.customers = state.customers.filter((item) => item.id !== customerId);
  return state.customers.length !== before;
}

export function createOfflineAffiliate(payload: Partial<Affiliate>) {
  const revenueGeneratedCents = payload.revenueGeneratedCents ?? 0;
  const payoutRatePercent = payload.payoutRatePercent ?? (payload.affiliateType === "wholesale" ? 15 : 20);
  const totalPayoutCents = payload.totalPayoutCents ?? 0;
  const affiliate: Affiliate = {
    id: id("aff"),
    name: payload.name ?? "",
    code: (payload.code ?? "").trim().toUpperCase(),
    affiliateType: payload.affiliateType ?? "online",
    status: payload.status === "N/A" ? "active" : payload.status ?? "active",
    revenueGeneratedCents,
    payoutRatePercent,
    totalPayoutCents,
    payoutDueCents: Math.max(Math.round((revenueGeneratedCents * payoutRatePercent) / 100) - totalPayoutCents, 0),
    referredCustomers: payload.referredCustomers ?? 0,
    referredOrders: payload.referredOrders ?? 0,
    lastPayoutAt: payload.lastPayoutAt ?? "N/A",
    notes: payload.notes ?? "N/A"
  };
  state.affiliates.unshift(affiliate);
  return affiliate;
}

export function updateOfflineAffiliate(affiliateId: string, payload: Partial<Affiliate>) {
  const affiliate = state.affiliates.find((item) => item.id === affiliateId);
  if (!affiliate) return null;
  Object.assign(affiliate, {
    name: payload.name ?? affiliate.name,
    code: payload.code ? payload.code.trim().toUpperCase() : affiliate.code,
    affiliateType: payload.affiliateType ?? affiliate.affiliateType,
    status: payload.status ?? affiliate.status,
    payoutRatePercent: payload.payoutRatePercent ?? affiliate.payoutRatePercent,
    totalPayoutCents: payload.totalPayoutCents ?? affiliate.totalPayoutCents,
    lastPayoutAt: payload.lastPayoutAt ?? affiliate.lastPayoutAt,
    notes: payload.notes ?? affiliate.notes
  });
  recalculateAffiliateStats(affiliate.id);
  return affiliate;
}

export function deleteOfflineAffiliate(affiliateId: string) {
  const before = state.affiliates.length;
  state.affiliates = state.affiliates.filter((item) => item.id !== affiliateId);
  return state.affiliates.length !== before;
}

export function createOfflineOrder(payload: OrderPayload, actor: SessionUser) {
  const order = buildOrder(payload, actor);
  allocateOrderInventory(order, actor);
  state.orders.unshift(order);
  recalculateCustomerStats(order.customerId);
  recalculateAffiliateStats(order.affiliateId);
  recalculateProductSales();
  return order;
}

export function updateOfflineOrder(orderId: string, payload: OrderPayload, actor: SessionUser) {
  const index = state.orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;
  const previous = state.orders[index];
  restoreOrderInventory(previous, actor);
  const updated = buildOrder(payload, actor, previous);
  allocateOrderInventory(updated, actor);
  state.orders[index] = updated;
  recalculateCustomerStats(previous.customerId);
  recalculateCustomerStats(updated.customerId);
  recalculateAffiliateStats(previous.affiliateId);
  recalculateAffiliateStats(updated.affiliateId);
  recalculateProductSales();
  return updated;
}

export function cancelOfflineOrder(orderId: string, actor: SessionUser) {
  const index = state.orders.findIndex((item) => item.id === orderId);
  const order = state.orders[index];
  if (!order) return null;
  restoreOrderInventory(order, actor);
  const canceled: Order = { ...order, paymentStatus: "canceled", fulfillmentStatus: "canceled" };
  state.orders.splice(index, 1);
  recalculateCustomerStats(order.customerId);
  recalculateAffiliateStats(order.affiliateId);
  recalculateProductSales();
  return canceled;
}

export function adjustOfflineInventory(payload: { batchId: string; quantityDelta: number; reason: string; status?: InventoryBatch["status"] }, actor: SessionUser) {
  const batch = state.inventoryBatches.find((item) => item.id === payload.batchId);
  if (!batch) throw new Error("Inventory batch not found.");
  const nextQuantity = batch.quantityOnHand + payload.quantityDelta;
  if (nextQuantity < 0) throw new Error("Inventory cannot go negative.");
  batch.quantityOnHand = nextQuantity;
  if (payload.status) batch.status = payload.status;
  addMovement(batch, payload.quantityDelta, payload.reason, actor);
  return batch;
}

export function createOfflineProduct(payload: Omit<Product, "id" | "marginPercent" | "unitsSoldToday" | "unitsSoldWeek" | "revenueWeekCents">) {
  const product: Product = {
    ...payload,
    id: id("prod"),
    marginPercent: payload.priceCents > 0 ? ((payload.priceCents - payload.costOfGoodsCents) / payload.priceCents) * 100 : 0,
    unitsSoldToday: 0,
    unitsSoldWeek: 0,
    revenueWeekCents: 0
  };
  state.products.unshift(product);
  return product;
}
