import assert from "node:assert/strict";
import test from "node:test";
import {
  affiliatePayoutDueCents,
  affiliateRevenueBasisCents,
  archiveAffiliateCode,
  canAssignAffiliate,
  canChangeAffiliateRate,
  canTransitionAffiliateStatus,
  displayAffiliateCode,
  isValidAffiliateCode,
  normalizeAffiliateCode
} from "@/lib/affiliate-rules";
import { affiliateInputSchema } from "@/lib/validation";

test("affiliate codes normalize to a case-insensitive database key", () => {
  assert.equal(normalizeAffiliateCode("  summer code!  "), "SUMMERCODE");
  assert.equal(normalizeAffiliateCode("partner_20-off"), "PARTNER_20-OFF");
  assert.equal(isValidAffiliateCode("ABC"), true);
  assert.equal(isValidAffiliateCode("AB"), false);
  assert.equal(isValidAffiliateCode("BAD CODE"), false);

  const parsed = affiliateInputSchema.parse({ name: "Partner", code: "summer-code" });
  assert.equal(parsed.code, "SUMMER-CODE");
  assert.equal(parsed.status, "pending");
});

test("declining archives a unique key while releasing the visible code", () => {
  const archived = archiveAffiliateCode("SUMMER20", "affiliate-123");
  assert.notEqual(archived, "SUMMER20");
  assert.equal(displayAffiliateCode(archived), "SUMMER20");
  assert.equal(normalizeAffiliateCode(displayAffiliateCode(archived)), "SUMMER20");
});

test("only active, non-archived affiliates are assignable", () => {
  assert.equal(canAssignAffiliate({ status: "active", archivedAt: null }), true);
  assert.equal(canAssignAffiliate({ status: "pending", archivedAt: null }), false);
  assert.equal(canAssignAffiliate({ status: "paused", archivedAt: null }), false);
  assert.equal(canAssignAffiliate({ status: "active", archivedAt: new Date() }), false);
  assert.equal(canAssignAffiliate(undefined), false);
});

test("commission uses product net and excludes shipping and tax", () => {
  assert.equal(affiliateRevenueBasisCents(20_000, 2_500), 17_500);
  assert.equal(affiliateRevenueBasisCents(2_000, 3_000), 0);
  assert.equal(affiliatePayoutDueCents(17_500, 2_000, 500), 3_000);
});

test("commission rate locks after attributed orders", () => {
  assert.equal(canChangeAffiliateRate(2_000, 1_500, 0), true);
  assert.equal(canChangeAffiliateRate(2_000, 2_000, 4), true);
  assert.equal(canChangeAffiliateRate(2_000, 1_500, 4), false);
});

test("affiliate lifecycle permits only approval, pause, and resume", () => {
  assert.equal(canTransitionAffiliateStatus("pending", "active"), true);
  assert.equal(canTransitionAffiliateStatus("active", "paused"), true);
  assert.equal(canTransitionAffiliateStatus("paused", "active"), true);
  assert.equal(canTransitionAffiliateStatus("active", "pending"), false);
  assert.equal(canTransitionAffiliateStatus("paused", "pending"), false);
});

test("marking the full due paid is naturally idempotent", () => {
  const earnedDue = affiliatePayoutDueCents(50_000, 2_000, 0);
  assert.equal(earnedDue, 10_000);
  assert.equal(affiliatePayoutDueCents(50_000, 2_000, earnedDue), 0);
});
