export const affiliateCodePattern = /^[A-Z0-9_-]{3,32}$/;
const archivedCodeMarker = "__ARCHIVED__";

export function normalizeAffiliateCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

export function isValidAffiliateCode(value: string) {
  return affiliateCodePattern.test(value);
}

export function archiveAffiliateCode(code: string, affiliateId: string) {
  return `${code}${archivedCodeMarker}${affiliateId}`;
}

export function displayAffiliateCode(code: string | null | undefined) {
  if (!code) return "N/A";
  return code.split(archivedCodeMarker)[0] || "N/A";
}

export function affiliateRevenueBasisCents(subtotalCents: number, discountCents: number) {
  return Math.max(subtotalCents - discountCents, 0);
}

export function affiliatePayoutDueCents(revenueCents: number, payoutRateBps: number, totalPaidCents: number) {
  const earned = Math.round((revenueCents * payoutRateBps) / 10_000);
  return Math.max(earned - totalPaidCents, 0);
}

export function canAssignAffiliate(affiliate: { status: string; archivedAt?: Date | string | null } | null | undefined) {
  return Boolean(affiliate && !affiliate.archivedAt && ["active", "approved"].includes(affiliate.status.toLowerCase()));
}

export function canonicalAffiliateStatus(status: string, archivedAt?: Date | string | null) {
  if (archivedAt) return "declined" as const;
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "approved") return "active" as const;
  if (normalized === "paused" || normalized === "disabled") return "paused" as const;
  if (normalized === "declined" || normalized === "rejected" || normalized === "archived") return "declined" as const;
  return "pending" as const;
}

export function canChangeAffiliateRate(currentRateBps: number, requestedRateBps: number, referredOrders: number) {
  return currentRateBps === requestedRateBps || referredOrders === 0;
}

export function canTransitionAffiliateStatus(current: string, requested: string) {
  const canonicalCurrent = canonicalAffiliateStatus(current);
  return canonicalCurrent === requested
    || (canonicalCurrent === "pending" && requested === "active")
    || (canonicalCurrent === "active" && requested === "paused")
    || (canonicalCurrent === "paused" && requested === "active");
}
