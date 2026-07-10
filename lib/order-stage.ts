import { FulfillmentStatus, OrderStatus, PaymentStatus } from "@prisma/client";

export const orderStages = ["unfulfilled", "paid", "packed", "shipped", "delivered"] as const;

export type OrderStage = (typeof orderStages)[number];

type PersistedOrderStage = {
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
};

export function isPaidStage(stage: OrderStage) {
  return stage !== "unfulfilled";
}

export function isReservedStage(stage: OrderStage) {
  return stage === "paid";
}

export function isSoldStage(stage: OrderStage) {
  return stage === "packed" || stage === "shipped" || stage === "delivered";
}

export function orderStageFromPersistence(order: PersistedOrderStage): OrderStage {
  if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED || order.fulfillmentStatus === FulfillmentStatus.FULFILLED) return "delivered";
  if (order.status === OrderStatus.SHIPPED) return "shipped";
  if (order.status === OrderStatus.READY_TO_SHIP || order.status === OrderStatus.PACKING || order.fulfillmentStatus === FulfillmentStatus.PACKED) return "packed";
  if (order.status === OrderStatus.PAID || order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.OVERPAID) return "paid";
  return "unfulfilled";
}

export function persistenceForOrderStage(stage: OrderStage): PersistedOrderStage {
  if (stage === "paid") {
    return { fulfillmentStatus: FulfillmentStatus.UNFULFILLED, paymentStatus: PaymentStatus.PAID, status: OrderStatus.PAID };
  }
  if (stage === "packed") {
    return { fulfillmentStatus: FulfillmentStatus.PACKED, paymentStatus: PaymentStatus.PAID, status: OrderStatus.READY_TO_SHIP };
  }
  if (stage === "shipped") {
    return { fulfillmentStatus: FulfillmentStatus.PACKED, paymentStatus: PaymentStatus.PAID, status: OrderStatus.SHIPPED };
  }
  if (stage === "delivered") {
    return { fulfillmentStatus: FulfillmentStatus.FULFILLED, paymentStatus: PaymentStatus.PAID, status: OrderStatus.DELIVERED };
  }
  return { fulfillmentStatus: FulfillmentStatus.UNFULFILLED, paymentStatus: PaymentStatus.PENDING, status: OrderStatus.AWAITING_PAYMENT };
}
