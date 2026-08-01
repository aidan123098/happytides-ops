import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

test("ShipStation webhooks reach their signature verifier without a staff session", () => {
  const response = middleware(new NextRequest("https://dashboard.happytides.help/api/webhooks/shipstation", {
    method: "POST"
  }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("other API routes still require a staff session", async () => {
  const response = middleware(new NextRequest("https://dashboard.happytides.help/api/orders"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
});
