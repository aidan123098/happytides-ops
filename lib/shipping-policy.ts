import type { OrderStage, ShippingAddress, ShippingRate } from "@/types/domain";

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
