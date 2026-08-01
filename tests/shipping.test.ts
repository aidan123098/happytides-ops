import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { canPurchaseShippingLabel, isShippingAddressComplete, shouldAdvanceOrderStage, sortShippingRates, trackingOrderStage } from "@/lib/shipping-policy";
import { getShipStationRates, purchaseShipStationLabel, ShipStationError } from "@/lib/services/shipstation";
import { ShipStationWebhookError, verifyShipStationWebhook } from "@/lib/services/shipstation-webhook";
import { orderInputSchema } from "@/lib/validation";
import type { ShippingAddress, ShippingRate } from "@/types/domain";

const address: ShippingAddress = {
  recipientName: "Ada Lovelace",
  line1: "123 Main St",
  city: "Tampa",
  region: "FL",
  postalCode: "33602",
  country: "US",
  residential: true
};

test("shipping policy requires complete US address and paid or packed stage", () => {
  assert.equal(isShippingAddressComplete(address), true);
  assert.equal(isShippingAddressComplete({ ...address, postalCode: "" }), false);
  assert.equal(canPurchaseShippingLabel("unfulfilled"), false);
  assert.equal(canPurchaseShippingLabel("paid"), true);
  assert.equal(canPurchaseShippingLabel("packed"), true);
  assert.equal(canPurchaseShippingLabel("shipped"), false);
});

test("rates sort by full cost and carrier tracking only moves orders forward", () => {
  const rates: ShippingRate[] = [
    { id: "2", carrierId: "c", carrierCode: "ups", carrierName: "UPS", serviceCode: "ground", serviceName: "Ground", amountCents: 900, currency: "usd" },
    { id: "1", carrierId: "c", carrierCode: "usps", carrierName: "USPS", serviceCode: "ga", serviceName: "Ground Advantage", amountCents: 600, currency: "usd" }
  ];
  assert.deepEqual(sortShippingRates(rates).map((rate) => rate.id), ["1", "2"]);
  assert.equal(trackingOrderStage("in_transit"), "shipped");
  assert.equal(trackingOrderStage("delivered"), "delivered");
  assert.equal(shouldAdvanceOrderStage("paid", "shipped"), true);
  assert.equal(shouldAdvanceOrderStage("delivered", "shipped"), false);
});

test("order validation requires an address for ship but not local pickup", () => {
  const base = {
    customerId: "customer",
    paymentMethod: "Zelle",
    items: [{ productId: "product", inventoryBatchId: "batch", quantity: 1, unitPriceCents: 1000, discountCents: 0 }]
  };
  assert.equal(orderInputSchema.safeParse({ ...base, deliveryMethod: "ship" }).success, false);
  assert.equal(orderInputSchema.safeParse({ ...base, deliveryMethod: "ship", shippingAddress: address }).success, true);
  assert.equal(orderInputSchema.safeParse({ ...base, deliveryMethod: "pickup" }).success, true);
});

test("ShipStation rate and label responses normalize through mocked fetch", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "test-key";
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/rates")) {
      return Response.json({
        shipment_id: "se-shipment",
        ship_to: { name: "Ada Lovelace", address_line1: "123 MAIN ST", city_locality: "TAMPA", state_province: "FL", postal_code: "33602", country_code: "US" },
        rate_response: {
          rates: [{
            rate_id: "se-rate",
            carrier_id: "se-carrier",
            carrier_code: "usps",
            carrier_friendly_name: "USPS",
            service_code: "usps_ground_advantage",
            service_type: "Ground Advantage",
            shipping_amount: { amount: 5, currency: "usd" },
            insurance_amount: { amount: 1, currency: "usd" },
            delivery_days: 3
          }]
        }
      });
    }
    return Response.json({
      label_id: "se-label",
      shipment_id: "se-shipment",
      rate_id: "se-rate",
      tracking_number: "9400000000000000000000",
      shipment_cost: { amount: 6, currency: "usd" },
      label_download: { pdf: "https://api.shipstation.com/v2/downloads/label.pdf" }
    });
  };

  try {
    const rates = await getShipStationRates({
      externalShipmentId: "HT-test",
      warehouseId: "se-warehouse",
      carrierIds: ["se-carrier"],
      address,
      parcel: { packageCode: "package", weightOz: 8, lengthIn: 6, widthIn: 4, heightIn: 4 }
    });
    assert.equal(rates.rates[0]?.amountCents, 600);
    assert.equal(rates.correctedAddress.line1, "123 MAIN ST");
    const label = await purchaseShipStationLabel("se-rate");
    assert.equal(label.labelId, "se-label");
    assert.equal(label.costCents, 600);
    assert.equal(requests[0]?.init?.headers instanceof Headers, false);
    assert.match(String(requests[1]?.init?.body), /"label_layout":"4x6"/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("an ambiguous ShipStation purchase timeout is marked for reconciliation", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "test-key";
  globalThis.fetch = async () => { throw new Error("timeout"); };
  try {
    await assert.rejects(() => purchaseShipStationLabel("se-rate"), (error: unknown) => {
      assert.equal(error instanceof ShipStationError, true);
      assert.equal((error as ShipStationError).ambiguous, true);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("ShipStation webhook verification requires the custom secret, current timestamp, and RSA signature", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.SHIPSTATION_WEBHOOK_SECRET;
  process.env.SHIPSTATION_WEBHOOK_SECRET = "webhook-test-secret";
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  const timestamp = new Date().toISOString();
  const rawBody = JSON.stringify({ resource_type: "API_TRACK", data: { tracking_number: "9400", status_code: "in_transit" } });
  const signer = createSign("RSA-SHA256");
  signer.update(`${timestamp}.${rawBody}`, "utf8");
  signer.end();
  const signature = signer.sign(privateKey, "base64");
  globalThis.fetch = async () => Response.json({ keys: [{ ...jwk, kid: "test-kid" }] }, { headers: { etag: "test" } });

  try {
    const request = new Request("https://dashboard.happytides.help/api/webhooks/shipstation", {
      method: "POST",
      headers: {
        "x-shipengine-rsa-sha256-key-id": "test-kid",
        "x-shipengine-rsa-sha256-signature": signature,
        "x-shipengine-timestamp": timestamp,
        "x-happytides-webhook-secret": "webhook-test-secret"
      },
      body: rawBody
    });
    await assert.doesNotReject(() => verifyShipStationWebhook(request, rawBody));

    const missingHeaders = new Request("https://dashboard.happytides.help/api/webhooks/shipstation", { method: "POST", body: rawBody });
    await assert.rejects(() => verifyShipStationWebhook(missingHeaders, rawBody), (error: unknown) => {
      assert.equal(error instanceof ShipStationWebhookError, true);
      assert.equal((error as ShipStationWebhookError).status, 404);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.SHIPSTATION_WEBHOOK_SECRET;
    else process.env.SHIPSTATION_WEBHOOK_SECRET = originalSecret;
  }
});
