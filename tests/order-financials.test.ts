import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderTotals } from "@/lib/order-totals";
import { normalizeShopifyOrderId, shopifyAdminOrderUrl } from "@/lib/shopify-order";
import { orderInputSchema } from "@/lib/validation";

const address = {
  recipientName: "Test Customer",
  line1: "123 Main Street",
  city: "Ithaca",
  region: "NY",
  postalCode: "14850",
  country: "US" as const,
  residential: true
};

const baseOrder = {
  customerId: "customer-1",
  paymentMethod: "Shopify" as const,
  paidTo: "aidan" as const,
  deliveryMethod: "ship" as const,
  shippingAddress: address,
  shippingCents: 999,
  items: [{ productId: "product-1", inventoryBatchId: "batch-1", quantity: 1, unitPriceCents: 1500, discountCents: 0 }]
};

test("Shopify order references normalize to the numeric admin ID", () => {
  assert.equal(normalizeShopifyOrderId("7093822324971"), "7093822324971");
  assert.equal(normalizeShopifyOrderId("gid://shopify/Order/7093822324971"), "7093822324971");
  assert.equal(normalizeShopifyOrderId("https://admin.shopify.com/store/happy-tides-ikkkdaq4/orders/7093822324971"), "7093822324971");
  assert.equal(normalizeShopifyOrderId("https://admin.shopify.com/store/another-store/orders/7093822324971"), undefined);
  assert.equal(normalizeShopifyOrderId("#1001"), undefined);
});

test("Shopify admin URLs use the configured store and exact numeric ID", () => {
  assert.equal(
    shopifyAdminOrderUrl("gid://shopify/Order/7093822324971"),
    "https://admin.shopify.com/store/happy-tides-ikkkdaq4/orders/7093822324971"
  );
});

test("Shopify payments require a valid admin order reference", () => {
  assert.equal(orderInputSchema.safeParse(baseOrder).success, false);
  assert.equal(orderInputSchema.safeParse({ ...baseOrder, shopifyOrderId: "gid://shopify/Order/7093822324971" }).success, true);
});

test("pickup orders reject shipping charges", () => {
  const result = orderInputSchema.safeParse({
    ...baseOrder,
    paymentMethod: "Zelle",
    deliveryMethod: "pickup",
    shippingAddress: undefined,
    shippingCents: 999
  });

  assert.equal(result.success, false);
});

test("shipping is included in shipped order totals and zeroed for pickup", () => {
  const items = [{ unitPriceCents: 1500, quantity: 1, discountCents: 0 }];
  assert.deepEqual(calculateOrderTotals(items, "ship", 999), {
    subtotalCents: 1500,
    discountCents: 0,
    shippingCents: 999,
    totalCents: 2499
  });
  assert.deepEqual(calculateOrderTotals(items, "pickup", 999), {
    subtotalCents: 1500,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 1500
  });
});
