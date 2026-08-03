import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { canPurchaseShippingLabel, isShippingAddressComplete, shippingRateBadges, shippingRatesUnderLimit, shouldAdvanceOrderStage, sortShippingRates, trackingOrderStage } from "@/lib/shipping-policy";
import { downloadShipStationLabel, getShipStationLabel, getShipStationRates, purchaseShipStationLabel, ShipStationError, voidShipStationLabel } from "@/lib/services/shipstation";
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
    { id: "2", carrierId: "c", carrierCode: "ups", carrierName: "UPS", serviceCode: "ground", serviceName: "Ground", amountCents: 900, currency: "usd", purchasable: true },
    { id: "1", carrierId: "c", carrierCode: "usps", carrierName: "USPS", serviceCode: "ga", serviceName: "Ground Advantage", amountCents: 600, currency: "usd", purchasable: true }
  ];
  assert.deepEqual(sortShippingRates(rates).map((rate) => rate.id), ["1", "2"]);
  assert.equal(trackingOrderStage("in_transit"), "shipped");
  assert.equal(trackingOrderStage("delivered"), "delivered");
  assert.equal(shouldAdvanceOrderStage("paid", "shipped"), true);
  assert.equal(shouldAdvanceOrderStage("delivered", "shipped"), false);
});

test("shipping quotes include only rates strictly under sixteen dollars", () => {
  const baseRate: ShippingRate = {
    id: "rate",
    carrierId: "carrier",
    carrierCode: "ups",
    carrierName: "UPS",
    serviceCode: "ups_ground",
    serviceName: "UPS Ground",
    amountCents: 0,
    currency: "usd",
    purchasable: true
  };
  const rates = [
    { ...baseRate, id: "over", amountCents: 1601 },
    { ...baseRate, id: "boundary", amountCents: 1600 },
    { ...baseRate, id: "included", amountCents: 1599 },
    { ...baseRate, id: "cheapest", amountCents: 710 }
  ];

  assert.deepEqual(shippingRatesUnderLimit(rates).map((rate) => rate.id), ["cheapest", "included"]);
});

test("shipping rate badges identify price ties, speed ties, and standard ground", () => {
  const baseRate: ShippingRate = {
    id: "rate",
    carrierId: "carrier",
    carrierCode: "ups",
    carrierName: "UPS",
    serviceCode: "service",
    serviceName: "Service",
    amountCents: 1000,
    currency: "usd",
    purchasable: true
  };
  const badges = shippingRateBadges([
    { ...baseRate, id: "saver", serviceCode: "ups_ground_saver", serviceName: "UPS Ground Saver", amountCents: 500, deliveryDays: 5 },
    { ...baseRate, id: "economy", serviceCode: "fedex_ground_economy", serviceName: "FedEx Ground Economy", amountCents: 500, deliveryDays: 6 },
    { ...baseRate, id: "standard", serviceCode: "ups_ground", serviceName: "UPS Ground", amountCents: 700, deliveryDays: 4 },
    { ...baseRate, id: "fast-a", serviceCode: "ups_next_day", serviceName: "UPS Next Day Air", deliveryDays: 1 },
    { ...baseRate, id: "fast-b", serviceCode: "fedex_overnight", serviceName: "FedEx Overnight", deliveryDays: 1 }
  ]);

  assert.deepEqual(badges.saver, ["Cheapest"]);
  assert.deepEqual(badges.economy, ["Cheapest"]);
  assert.deepEqual(badges.standard, ["Standard"]);
  assert.deepEqual(badges["fast-a"], ["Fastest"]);
  assert.deepEqual(badges["fast-b"], ["Fastest"]);
});

test("shipping rate badges use the earliest delivery date when day counts are unavailable", () => {
  const rates: ShippingRate[] = [
    { id: "later", carrierId: "c", carrierCode: "ups", carrierName: "UPS", serviceCode: "later", serviceName: "Later", amountCents: 700, currency: "usd", purchasable: true, estimatedDeliveryAt: "2026-08-06T12:00:00.000Z" },
    { id: "early-a", carrierId: "c", carrierCode: "ups", carrierName: "UPS", serviceCode: "early-a", serviceName: "Early A", amountCents: 800, currency: "usd", purchasable: true, estimatedDeliveryAt: "2026-08-04T12:00:00.000Z" },
    { id: "early-b", carrierId: "c", carrierCode: "fedex", carrierName: "FedEx", serviceCode: "early-b", serviceName: "Early B", amountCents: 900, currency: "usd", purchasable: true, estimatedDeliveryAt: "2026-08-04T12:00:00.000Z" }
  ];

  const badges = shippingRateBadges(rates);
  assert.deepEqual(badges["early-a"], ["Fastest"]);
  assert.deepEqual(badges["early-b"], ["Fastest"]);
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
    assert.equal(new URL(requests[0]!.url).pathname, "/v2/rates");
    assert.equal(requests[0]?.init?.headers instanceof Headers, false);
    assert.equal((requests[0]?.init?.headers as Record<string, string>)["API-Key"], "test-key");
    assert.match(String(requests[0]?.init?.body), /"validate_address":"validate_and_clean"/);
    assert.equal(new URL(requests[1]!.url).pathname, "/v2/labels/rates/se-rate");
    assert.equal(requests[1]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), {
      validate_address: "validate_and_clean",
      label_format: "pdf",
      label_layout: "4x6",
      label_download_type: "url",
      display_scheme: "label"
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("UPS Ground Saver remains selectable and uses its exact returned rate id", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "test-key";
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.includes("/labels/rates/")) {
      return Response.json({
        label_id: "se-ground-saver-label",
        shipment_id: "se-shipment",
        rate_id: "se-ground-saver",
        tracking_number: "1ZGROUND",
        shipment_cost: { amount: 5.69, currency: "usd" },
        label_download: { pdf: "https://api.shipstation.com/v2/downloads/ground-saver.pdf" }
      });
    }
    return Response.json({
      shipment_id: "se-shipment",
      rate_response: {
        rates: [
          {
            rate_id: "se-ground-saver",
            carrier_id: "se-ups",
            carrier_code: "ups",
            carrier_friendly_name: "UPS",
            service_code: "ups_ground_saver",
            service_type: "UPS Ground Saver",
            shipping_amount: { amount: 5.69, currency: "usd" }
          },
          {
            rate_id: "se-ground",
            carrier_id: "se-ups",
            carrier_code: "ups",
            carrier_friendly_name: "UPS",
            service_code: "ups_ground",
            service_type: "UPS Ground",
            shipping_amount: { amount: 7.1, currency: "usd" }
          }
        ]
      }
    });
  };

  try {
    const result = await getShipStationRates({
      externalShipmentId: "HT-test",
      warehouseId: "se-warehouse",
      carrierIds: ["se-ups"],
      address,
      parcel: { packageCode: "package", weightOz: 3, lengthIn: 10, widthIn: 6, heightIn: 1 }
    });
    assert.equal(result.rates[0]?.id, "se-ground-saver");
    assert.equal(result.rates[0]?.purchasable, true);
    assert.equal(result.rates[1]?.id, "se-ground");
    assert.equal(result.rates[1]?.purchasable, true);

    const label = await purchaseShipStationLabel("se-ground-saver");
    assert.equal(label.labelId, "se-ground-saver-label");
    assert.equal(new URL(requests[1]!.url).pathname, "/v2/labels/rates/se-ground-saver");
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("ShipStation label errors retain the exact rate path and upstream status", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "test-key";
  globalThis.fetch = async () => Response.json({ errors: [{ message: "Carrier rejected this service." }] }, { status: 422 });

  try {
    await assert.rejects(() => purchaseShipStationLabel("se-ground"), (error: unknown) => {
      assert.equal(error instanceof ShipStationError, true);
      assert.equal((error as ShipStationError).status, 422);
      assert.equal((error as ShipStationError).providerPath, "/v2/labels/rates/se-ground");
      assert.equal((error as ShipStationError).message, "Carrier rejected this service.");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("completed labels can be reloaded, downloaded as PDF, and explicitly voided", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "  test-key  ";
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/labels/se-label")) {
      return Response.json({
        label_id: "se-label",
        shipment_id: "se-shipment",
        tracking_number: "1Z999",
        label_download: { pdf: "https://api.shipstation.com/v2/downloads/labels/test.pdf" }
      });
    }
    if (url.endsWith("/labels/se-label/void")) {
      return Response.json({ approved: true, message: "Refund requested." });
    }
    return new Response("%PDF-1.4\n", { headers: { "Content-Type": "application/pdf" } });
  };

  try {
    const label = await getShipStationLabel("se-label");
    assert.equal(label.trackingNumber, "1Z999");
    const pdf = await downloadShipStationLabel(label.labelDownloadUrl!);
    assert.equal(new TextDecoder().decode(pdf), "%PDF-1.4\n");
    const voidResult = await voidShipStationLabel("se-label");
    assert.deepEqual(voidResult, { approved: true, message: "Refund requested." });

    assert.equal(new URL(requests[0]!.url).pathname, "/v2/labels/se-label");
    assert.equal(new URL(requests[1]!.url).pathname, "/v2/downloads/labels/test.pdf");
    assert.equal((requests[1]?.init?.headers as Record<string, string>)["API-Key"], "test-key");
    assert.equal(new URL(requests[2]!.url).pathname, "/v2/labels/se-label/void");
    assert.equal(requests[2]?.init?.method, "PUT");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("a void response without explicit provider approval is not accepted", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "test-key";
  globalThis.fetch = async () => Response.json({ message: "Request received." });

  try {
    const result = await voidShipStationLabel("se-label");
    assert.equal(result.approved, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("ShipStation rate shopping validates and cleans the address in one request", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "  test-key  ";
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    return Response.json({
      shipment_id: "se-shipment",
      ship_to: { name: "Ada Lovelace", address_line1: "123 MAIN ST", city_locality: "TAMPA", state_province: "FL", postal_code: "33602", country_code: "US" },
      rate_response: {
        rates: [{
          rate_id: "se-rate",
          carrier_id: "se-carrier",
          carrier_code: "ups",
          carrier_friendly_name: "UPS",
          service_code: "ups_ground",
          service_type: "Ground",
          shipping_amount: { amount: 7.5, currency: "usd" }
        }]
      }
    });
  };

  try {
    const rates = await getShipStationRates({
      externalShipmentId: "HT-test",
      warehouseId: "se-warehouse",
      carrierIds: ["se-carrier"],
      address,
      parcel: { packageCode: "package", weightOz: 3, lengthIn: 10, widthIn: 6, heightIn: 1 }
    });
    assert.equal(rates.rates[0]?.amountCents, 750);
    assert.equal(rates.correctedAddress.line1, "123 MAIN ST");
    assert.equal(requests.length, 1);
    assert.equal(new URL(requests[0]!.url).pathname, "/v2/rates");
    assert.equal((requests[0]?.init?.headers as Record<string, string>)["API-Key"], "test-key");
    assert.match(String(requests[0]?.init?.body), /"validate_address":"validate_and_clean"/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("ShipStation rate errors retain the upstream path and status", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "test-key";
  globalThis.fetch = async () => Response.json({ errors: [{ message: "Forbidden." }] }, { status: 403 });

  try {
    await assert.rejects(() => getShipStationRates({
      externalShipmentId: "HT-test",
      warehouseId: "se-warehouse",
      carrierIds: ["se-carrier"],
      address,
      parcel: { packageCode: "package", weightOz: 3, lengthIn: 10, widthIn: 6, heightIn: 1 }
    }), (error: unknown) => {
      assert.equal(error instanceof ShipStationError, true);
      assert.equal((error as ShipStationError).status, 403);
      assert.equal((error as ShipStationError).providerPath, "/v2/rates");
      assert.equal((error as ShipStationError).message, "Forbidden.");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SHIPSTATION_API_KEY;
    else process.env.SHIPSTATION_API_KEY = originalKey;
  }
});

test("ShipStation surfaces carrier errors from a successful empty rate response", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SHIPSTATION_API_KEY;
  process.env.SHIPSTATION_API_KEY = "test-key";
  globalThis.fetch = async () => Response.json({
    rate_response: {
      rates: [],
      invalid_rates: [{
        carrier_friendly_name: "UPS",
        service_type: "Ground",
        error_messages: ["The ship-from postal code is required."]
      }],
      errors: [{ message: "The carrier account cannot provide rates." }]
    }
  });

  try {
    await assert.rejects(() => getShipStationRates({
      externalShipmentId: "HT-test",
      warehouseId: "se-warehouse",
      carrierIds: ["se-carrier"],
      address,
      parcel: { packageCode: "package", weightOz: 3, lengthIn: 10, widthIn: 6, heightIn: 1 }
    }), (error: unknown) => {
      assert.equal(error instanceof ShipStationError, true);
      assert.equal((error as ShipStationError).status, 200);
      assert.equal((error as ShipStationError).providerPath, "/v2/rates");
      assert.match((error as ShipStationError).message, /carrier account cannot provide rates/i);
      assert.match((error as ShipStationError).message, /UPS Ground: The ship-from postal code is required\./);
      return true;
    });
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
