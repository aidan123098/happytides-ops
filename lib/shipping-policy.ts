import type { OrderStage, ShippingAddress, ShippingRate } from "@/types/domain";

export const shippingRateLimitCents = 1600;

export function isShippingAddressComplete(address: Partial<ShippingAddress> | null | undefined) {
  return Boolean(
    address?.recipientName?.trim()
    && address.line1?.trim()
    && address.city?.trim()
    && address.region?.trim().length === 2
    && address.postalCode?.trim()
    && address.country === "US"
  );
}

export function canPurchaseShippingLabel(stage: OrderStage) {
  return stage === "paid" || stage === "packed";
}

export function sortShippingRates(rates: ShippingRate[]) {
  return [...rates].sort((left, right) => left.amountCents - right.amountCents || left.serviceName.localeCompare(right.serviceName));
}

export function shippingRatesUnderLimit(rates: ShippingRate[]) {
  return sortShippingRates(rates.filter((rate) => rate.amountCents < shippingRateLimitCents));
}

export type ShippingRateBadge = "Cheapest" | "Fastest" | "Standard";

export function shippingRateBadges(rates: ShippingRate[]) {
  const badges = Object.fromEntries(rates.map((rate) => [rate.id, [] as ShippingRateBadge[]]));
  const purchasableRates = rates.filter((rate) => rate.purchasable);
  if (purchasableRates.length === 0) return badges;

  const cheapestAmount = Math.min(...purchasableRates.map((rate) => rate.amountCents));
  for (const rate of purchasableRates.filter((candidate) => candidate.amountCents === cheapestAmount)) {
    badges[rate.id]?.push("Cheapest");
  }

  const ratesWithDeliveryDays = purchasableRates.filter((rate) => typeof rate.deliveryDays === "number" && rate.deliveryDays > 0);
  if (ratesWithDeliveryDays.length > 0) {
    const fastestDays = Math.min(...ratesWithDeliveryDays.map((rate) => rate.deliveryDays!));
    for (const rate of ratesWithDeliveryDays.filter((candidate) => candidate.deliveryDays === fastestDays)) {
      badges[rate.id]?.push("Fastest");
    }
  } else {
    const ratesWithDeliveryDates = purchasableRates
      .map((rate) => ({ rate, time: rate.estimatedDeliveryAt ? new Date(rate.estimatedDeliveryAt).getTime() : Number.NaN }))
      .filter((entry) => Number.isFinite(entry.time));
    if (ratesWithDeliveryDates.length > 0) {
      const fastestTime = Math.min(...ratesWithDeliveryDates.map((entry) => entry.time));
      for (const entry of ratesWithDeliveryDates.filter((candidate) => candidate.time === fastestTime)) {
        badges[entry.rate.id]?.push("Fastest");
      }
    }
  }

  for (const rate of purchasableRates) {
    const service = `${rate.serviceCode} ${rate.serviceName}`.toLowerCase();
    if (service.includes("ground") && !service.includes("saver") && !service.includes("economy")) {
      badges[rate.id]?.push("Standard");
    }
  }

  return badges;
}

export function trackingOrderStage(statusCode: string | null | undefined, statusDetail?: string | null): OrderStage | undefined {
  const normalized = `${statusCode ?? ""} ${statusDetail ?? ""}`.toLowerCase().replaceAll("_", " ");

  if (normalized.includes("delivered")) return "delivered";
  if (
    normalized.includes("in transit")
    || normalized.includes("accepted")
    || normalized.includes("picked up")
    || normalized.includes("out for delivery")
  ) return "shipped";

  return undefined;
}

const orderStageRank: Record<OrderStage, number> = {
  unfulfilled: 0,
  paid: 1,
  packed: 2,
  shipped: 3,
  delivered: 4
};

export function shouldAdvanceOrderStage(current: OrderStage, target: OrderStage) {
  return orderStageRank[target] > orderStageRank[current];
}
