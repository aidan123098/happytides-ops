import { createHash, randomUUID } from "crypto";
import { OrderDeliveryMethod, Prisma, ShippingShipmentStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { orderStageFromPersistence } from "@/lib/order-stage";
import { prisma } from "@/lib/prisma";
import { canPurchaseShippingLabel, isShippingAddressComplete, sortShippingRates } from "@/lib/shipping-policy";
import { getOrders } from "@/lib/services/operational-data";
import {
  downloadShipStationLabel,
  ensureShipStationTrackingWebhook,
  findShipStationLabel,
  getShipStationLabel,
  getShipStationRates,
  isShipStationConfigured,
  listShipStationCarriers,
  listShipStationWarehouses,
  purchaseShipStationLabel,
  ShipStationError,
  testShipStationConnection,
  voidShipStationLabel,
  type ShipStationLabel,
  type ShipStationParcel
} from "@/lib/services/shipstation";
import type { ShippingAddress, ShippingConfig, ShippingRate } from "@/types/domain";

const configId = "default";

function numberOrUndefined(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? undefined : Number(value);
}

function stringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function ratesFromJson(value: Prisma.JsonValue | null | undefined): ShippingRate[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ShippingRate => {
    return typeof entry === "object" && entry !== null && !Array.isArray(entry)
      && typeof entry.id === "string"
      && typeof entry.amountCents === "number";
  });
}

function configToDomain(config: {
  enabled: boolean;
  warehouseId: string | null;
  enabledCarrierIds: Prisma.JsonValue | null;
  defaultPackageCode: string;
  defaultWeightOz: Prisma.Decimal | null;
  defaultLengthIn: Prisma.Decimal | null;
  defaultWidthIn: Prisma.Decimal | null;
  defaultHeightIn: Prisma.Decimal | null;
  labelFormat: string;
  labelLayout: string;
} | null): ShippingConfig {
  const carrierIds = stringArray(config?.enabledCarrierIds);
  const warehouseId = config?.warehouseId ?? undefined;
  const weight = numberOrUndefined(config?.defaultWeightOz);
  const length = numberOrUndefined(config?.defaultLengthIn);
  const width = numberOrUndefined(config?.defaultWidthIn);
  const height = numberOrUndefined(config?.defaultHeightIn);
  const configured = Boolean(isShipStationConfigured() && process.env.SHIPSTATION_WEBHOOK_SECRET?.trim() && warehouseId && carrierIds.length && weight && length && width && height);

  return {
    enabled: config?.enabled ?? false,
    configured,
    apiConnected: isShipStationConfigured(),
    webhookConfigured: Boolean(process.env.SHIPSTATION_WEBHOOK_SECRET?.trim()),
    warehouseId,
    enabledCarrierIds: carrierIds,
    defaultPackageCode: config?.defaultPackageCode ?? "package",
    defaultWeightOz: weight,
    defaultLengthIn: length,
    defaultWidthIn: width,
    defaultHeightIn: height,
    labelFormat: "pdf",
    labelLayout: "4x6"
  };
}

function addressFromOrder(order: {
  shipToName: string | null;
  shipToCompany: string | null;
  shipToLine1: string | null;
  shipToLine2: string | null;
  shipToCity: string | null;
  shipToRegion: string | null;
  shipToPostalCode: string | null;
  shipToCountry: string | null;
  shipToPhone: string | null;
  shipToEmail: string | null;
  shipToResidential: boolean;
}): ShippingAddress | undefined {
  const address: Partial<ShippingAddress> = {
    recipientName: order.shipToName ?? undefined,
    company: order.shipToCompany ?? undefined,
    line1: order.shipToLine1 ?? undefined,
    line2: order.shipToLine2 ?? undefined,
    city: order.shipToCity ?? undefined,
    region: order.shipToRegion ?? undefined,
    postalCode: order.shipToPostalCode ?? undefined,
    country: order.shipToCountry === "US" ? "US" : undefined,
    phone: order.shipToPhone ?? undefined,
    email: order.shipToEmail ?? undefined,
    residential: order.shipToResidential
  };
  return isShippingAddressComplete(address) ? address as ShippingAddress : undefined;
}

function addressData(address: ShippingAddress) {
  return {
    shipToName: address.recipientName,
    shipToCompany: address.company || null,
    shipToLine1: address.line1,
    shipToLine2: address.line2 || null,
    shipToCity: address.city,
    shipToRegion: address.region,
    shipToPostalCode: address.postalCode,
    shipToCountry: "US",
    shipToPhone: address.phone || null,
    shipToEmail: address.email || null,
    shipToResidential: address.residential
  };
}

function sameAddress(left: ShippingAddress, right: ShippingAddress) {
  return JSON.stringify(addressData(left)) === JSON.stringify(addressData(right));
}

function addressHash(address: ShippingAddress) {
  return createHash("sha256").update(JSON.stringify(addressData(address))).digest("hex");
}

function parcelFromConfig(config: ShippingConfig, override?: ShipStationParcel): ShipStationParcel {
  if (override) return override;
  if (!config.defaultWeightOz || !config.defaultLengthIn || !config.defaultWidthIn || !config.defaultHeightIn) {
    throw new Error("Set the default package weight and dimensions in Shipping settings.");
  }
  return {
    packageCode: config.defaultPackageCode,
    weightOz: config.defaultWeightOz,
    lengthIn: config.defaultLengthIn,
    widthIn: config.defaultWidthIn,
    heightIn: config.defaultHeightIn
  };
}

async function requiredShippingConfig() {
  const config = await getShippingConfig();
  if (!config.enabled) throw new Error("Shipping labels are disabled in Settings.");
  if (!config.configured || !config.warehouseId || !config.enabledCarrierIds.length) {
    throw new Error("Finish the ShipStation warehouse, carrier, and package setup before reviewing rates.");
  }
  return config;
}

export async function getShippingConfig() {
  return configToDomain(await prisma.shippingConfig.findUnique({ where: { id: configId } }));
}

export async function saveShippingConfig(input: {
  enabled: boolean;
  warehouseId: string;
  enabledCarrierIds: string[];
  defaultPackageCode: string;
  defaultWeightOz: number;
  defaultLengthIn: number;
  defaultWidthIn: number;
  defaultHeightIn: number;
}, actor: SessionUser, request?: Request) {
  if (input.enabled && !isShipStationConfigured()) throw new Error("Add SHIPSTATION_API_KEY before enabling shipping labels.");
  if (input.enabled) {
    const webhookSecret = process.env.SHIPSTATION_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) throw new Error("Add SHIPSTATION_WEBHOOK_SECRET before enabling shipping labels.");
    const appUrl = (process.env.APP_URL || process.env.AUTH_URL || (request ? new URL(request.url).origin : "")).replace(/\/$/, "");
    if (!appUrl?.startsWith("https://")) throw new Error("Set APP_URL to the production HTTPS address before enabling shipping labels.");
    const setup = await getShipStationSetup();
    if (!setup.warehouses.some((warehouse) => warehouse.id === input.warehouseId)) throw new Error("The selected ShipStation warehouse is no longer connected.");
    if (input.enabledCarrierIds.some((id) => !setup.carriers.some((carrier) => carrier.id === id))) throw new Error("One or more selected ShipStation carriers are no longer connected.");
    await ensureShipStationTrackingWebhook(`${appUrl}/api/webhooks/shipstation`, webhookSecret);
  }
  const before = await prisma.shippingConfig.findUnique({ where: { id: configId } });
  const config = await prisma.$transaction(async (tx) => {
    const saved = await tx.shippingConfig.upsert({
      where: { id: configId },
      create: {
        id: configId,
        enabled: input.enabled,
        warehouseId: input.warehouseId,
        enabledCarrierIds: input.enabledCarrierIds,
        defaultPackageCode: input.defaultPackageCode,
        defaultWeightOz: input.defaultWeightOz,
        defaultLengthIn: input.defaultLengthIn,
        defaultWidthIn: input.defaultWidthIn,
        defaultHeightIn: input.defaultHeightIn
      },
      update: {
        enabled: input.enabled,
        warehouseId: input.warehouseId,
        enabledCarrierIds: input.enabledCarrierIds,
        defaultPackageCode: input.defaultPackageCode,
        defaultWeightOz: input.defaultWeightOz,
        defaultLengthIn: input.defaultLengthIn,
        defaultWidthIn: input.defaultWidthIn,
        defaultHeightIn: input.defaultHeightIn
      }
    });
    await writeAuditLog({ actor, entityType: "SETTINGS", entityId: configId, action: "SHIPPING_SETTINGS_UPDATED", before, after: saved, request }, tx);
    return saved;
  });
  return configToDomain(config);
}

export async function getShipStationSetup() {
  const connected = await testShipStationConnection();
  const [warehouses, carriers] = await Promise.all([listShipStationWarehouses(), listShipStationCarriers()]);
  return { connected, warehouses, carriers };
}

export async function getShippingQueue() {
  const orders = await getOrders();
  return orders.filter((order) => order.deliveryMethod === "ship" && order.fulfillmentStatus !== "canceled");
}

export async function updateOrderShippingAddress(input: {
  orderId: string;
  address: ShippingAddress;
  saveAsCustomerDefault: boolean;
}, actor: SessionUser, request?: Request) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.archivedAt) throw new Error("Order not found.");
    const activeLabel = await tx.shippingShipment.findFirst({ where: { orderId: order.id, activeKey: { not: null } }, select: { id: true } });
    if (activeLabel) throw new Error("Void the active shipping label before changing this address.");

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { deliveryMethod: OrderDeliveryMethod.SHIP, ...addressData(input.address) }
    });

    if (input.saveAsCustomerDefault) {
      const current = await tx.customerShippingAddress.findFirst({
        where: { customerId: order.customerId, isDefault: true, archivedAt: null },
        orderBy: { updatedAt: "desc" }
      });
      await tx.customerShippingAddress.updateMany({
        where: { customerId: order.customerId, isDefault: true, archivedAt: null },
        data: { isDefault: false }
      });
      const address = {
        recipientName: input.address.recipientName,
        company: input.address.company || null,
        line1: input.address.line1,
        line2: input.address.line2 || null,
        city: input.address.city,
        region: input.address.region,
        postalCode: input.address.postalCode,
        country: "US",
        phone: input.address.phone || null,
        email: input.address.email || null,
        residential: input.address.residential,
        isDefault: true
      };
      if (current) await tx.customerShippingAddress.update({ where: { id: current.id }, data: address });
      else await tx.customerShippingAddress.create({ data: { customerId: order.customerId, ...address } });
    }

    await writeAuditLog({
      actor,
      entityType: "ORDER",
      entityId: order.id,
      action: "SHIPPING_ADDRESS_UPDATED",
      before: order,
      after: updated,
      request
    }, tx);
    return updated;
  });
}

export async function prepareShippingRates(input: {
  orderId: string;
  parcel?: ShipStationParcel;
}, actor: SessionUser) {
  const config = await requiredShippingConfig();
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { shippingShipments: { where: { activeKey: { not: null } }, take: 1 } }
  });
  if (!order || order.archivedAt || order.deliveryMethod !== OrderDeliveryMethod.SHIP) throw new Error("This order is not available for shipping.");
  if (order.shippingShipments.length) throw new Error("This order already has a live label.");
  const stage = orderStageFromPersistence(order);
  if (!canPurchaseShippingLabel(stage)) throw new Error("Labels can be created only for Paid or Packed orders.");
  const originalAddress = addressFromOrder(order);
  if (!originalAddress) throw new Error("Add a complete US shipping address before reviewing rates.");
  const parcel = parcelFromConfig(config, input.parcel);

  const shipment = await prisma.shippingShipment.create({
    data: {
      orderId: order.id,
      createdById: actor.id,
      externalShipmentId: `HT-${order.id}-${randomUUID().slice(0, 8)}`,
      warehouseId: config.warehouseId!,
      sourceAddressHash: addressHash(originalAddress),
      packageCode: parcel.packageCode,
      weightOz: parcel.weightOz,
      lengthIn: parcel.lengthIn,
      widthIn: parcel.widthIn,
      heightIn: parcel.heightIn,
      ...addressData(originalAddress)
    }
  });

  try {
    const result = await getShipStationRates({
      externalShipmentId: shipment.externalShipmentId,
      warehouseId: config.warehouseId!,
      carrierIds: config.enabledCarrierIds,
      address: originalAddress,
      parcel
    });
    const rates = sortShippingRates(result.rates);
    if (!rates.length) throw new Error("No connected carrier returned a rate for this shipment.");
    const correctedAddress = result.correctedAddress;
    await prisma.shippingShipment.update({
      where: { id: shipment.id },
      data: {
        providerShipmentId: result.shipmentId,
        quotedRates: rates as unknown as Prisma.InputJsonValue,
        ...addressData(correctedAddress)
      }
    });
    return {
      shipmentId: shipment.id,
      originalAddress,
      correctedAddress,
      addressCorrected: !sameAddress(originalAddress, correctedAddress),
      addressMessages: [],
      parcel,
      rates
    };
  } catch (error) {
    await prisma.shippingShipment.update({
      where: { id: shipment.id },
      data: { status: ShippingShipmentStatus.ERROR, errorMessage: error instanceof Error ? error.message : "Rate lookup failed." }
    });
    throw error;
  }
}

async function completePurchasedLabel(shipmentId: string, rate: ShippingRate, label: ShipStationLabel) {
  return prisma.shippingShipment.update({
    where: { id: shipmentId },
    data: {
      status: ShippingShipmentStatus.COMPLETED,
      providerRateId: rate.id,
      providerShipmentId: label.shipmentId,
      providerLabelId: label.labelId,
      carrierId: label.carrierId || rate.carrierId,
      carrierCode: label.carrierCode || rate.carrierCode,
      serviceCode: label.serviceCode || rate.serviceCode,
      serviceName: label.serviceName || rate.serviceName,
      postageCostCents: label.costCents ?? rate.amountCents,
      currency: label.currency || rate.currency,
      trackingNumber: label.trackingNumber,
      trackingUrl: label.trackingUrl,
      trackingStatus: label.trackingStatus ?? "label_created",
      labelDownloadUrl: label.labelDownloadUrl,
      estimatedDeliveryAt: label.estimatedDeliveryAt ? new Date(label.estimatedDeliveryAt) : null,
      errorMessage: null
    }
  });
}

async function reconcilePurchasedLabel(shipment: {
  id: string;
  externalShipmentId: string;
  providerRateId: string | null;
  quotedRates: Prisma.JsonValue | null;
}) {
  const label = await findShipStationLabel(shipment.externalShipmentId);
  if (!label) return undefined;
  const rates = ratesFromJson(shipment.quotedRates);
  const rate = rates.find((item) => item.id === (label.rateId ?? shipment.providerRateId)) ?? rates[0];
  if (!rate) throw new Error("The recovered ShipStation label has no matching local rate snapshot.");
  return completePurchasedLabel(shipment.id, rate, label);
}

export async function purchaseShippingLabel(input: { shipmentId: string; rateId: string }, actor: SessionUser, request?: Request) {
  const initial = await prisma.shippingShipment.findUnique({ where: { id: input.shipmentId }, include: { order: true } });
  if (!initial || initial.order.archivedAt) throw new Error("Shipping draft not found.");
  if (initial.createdById !== actor.id) throw new Error("Review the rates again before buying this label.");

  if (initial.status === ShippingShipmentStatus.RECONCILING) {
    const recovered = await reconcilePurchasedLabel(initial);
    if (recovered) return { shipment: recovered, pending: false };
    return { shipment: initial, pending: true };
  }
  if (initial.status === ShippingShipmentStatus.COMPLETED && initial.providerLabelId) return { shipment: initial, pending: false };
  if (initial.status !== ShippingShipmentStatus.DRAFT) throw new Error("These rates are no longer available. Review rates again.");

  const stage = orderStageFromPersistence(initial.order);
  if (!canPurchaseShippingLabel(stage)) throw new Error("Labels can be created only for Paid or Packed orders.");
  const currentAddress = addressFromOrder(initial.order);
  if (!currentAddress || addressHash(currentAddress) !== initial.sourceAddressHash) {
    throw new Error("The order address changed. Review rates again.");
  }
  const rate = ratesFromJson(initial.quotedRates).find((item) => item.id === input.rateId);
  if (!rate) throw new Error("The selected rate is no longer valid. Review rates again.");

  try {
    const claimed = await prisma.shippingShipment.updateMany({
      where: { id: initial.id, status: ShippingShipmentStatus.DRAFT, activeKey: null },
      data: { status: ShippingShipmentStatus.PURCHASING, activeKey: initial.orderId, providerRateId: rate.id, errorMessage: null }
    });
    if (claimed.count !== 1) throw new Error("This label purchase is already in progress.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("This order already has a live label.");
    }
    throw error;
  }

  try {
    let label: ShipStationLabel;
    try {
      label = await purchaseShipStationLabel(rate.id);
    } catch (error) {
      if (!(error instanceof ShipStationError) || !error.ambiguous) throw error;
      const recovered = await findShipStationLabel(initial.externalShipmentId);
      if (!recovered) {
        const reconciling = await prisma.shippingShipment.update({
          where: { id: initial.id },
          data: { status: ShippingShipmentStatus.RECONCILING, errorMessage: "Confirming whether ShipStation completed the purchase." }
        });
        return { shipment: reconciling, pending: true };
      }
      label = recovered;
    }

    const completed = await completePurchasedLabel(initial.id, rate, label);
    await writeAuditLog({
      actor,
      entityType: "ORDER",
      entityId: initial.orderId,
      action: "SHIPPING_LABEL_PURCHASED",
      metadata: { shipmentId: completed.id, labelId: completed.providerLabelId, rateId: rate.id, postageCostCents: completed.postageCostCents },
      request
    });
    return { shipment: completed, pending: false };
  } catch (error) {
    await prisma.shippingShipment.update({
      where: { id: initial.id },
      data: {
        status: error instanceof ShipStationError && error.ambiguous ? ShippingShipmentStatus.RECONCILING : ShippingShipmentStatus.ERROR,
        activeKey: error instanceof ShipStationError && error.ambiguous ? initial.orderId : null,
        errorMessage: error instanceof Error ? error.message : "Label purchase failed."
      }
    });
    throw error;
  }
}

export async function voidShippingLabel(shipmentId: string, actor: SessionUser, request?: Request) {
  const shipment = await prisma.shippingShipment.findUnique({ where: { id: shipmentId } });
  if (!shipment?.providerLabelId || !shipment.activeKey) throw new Error("No live label was found.");
  const previousStatus = shipment.status;
  await prisma.shippingShipment.update({ where: { id: shipment.id }, data: { status: ShippingShipmentStatus.VOID_PENDING } });

  try {
    const response = await voidShipStationLabel(shipment.providerLabelId);
    if (!response.approved) throw new Error(response.message ?? "ShipStation did not approve the void request.");
    const voided = await prisma.shippingShipment.update({
      where: { id: shipment.id },
      data: {
        status: ShippingShipmentStatus.VOIDED,
        activeKey: null,
        voidedAt: new Date(),
        voidResponse: response as Prisma.InputJsonValue,
        errorMessage: null
      }
    });
    await writeAuditLog({
      actor,
      entityType: "ORDER",
      entityId: shipment.orderId,
      action: "SHIPPING_LABEL_VOIDED",
      metadata: { shipmentId: shipment.id, labelId: shipment.providerLabelId, response },
      request
    });
    return voided;
  } catch (error) {
    await prisma.shippingShipment.update({
      where: { id: shipment.id },
      data: { status: previousStatus, errorMessage: error instanceof Error ? error.message : "Label void failed." }
    });
    throw error;
  }
}

export async function getShippingLabelPdf(shipmentId: string) {
  const shipment = await prisma.shippingShipment.findUnique({ where: { id: shipmentId } });
  if (!shipment?.providerLabelId) throw new Error("Label not found.");
  const label = await getShipStationLabel(shipment.providerLabelId);
  const downloadUrl = label.labelDownloadUrl ?? shipment.labelDownloadUrl;
  if (!downloadUrl) throw new Error("ShipStation did not return a PDF link for this label.");
  if (downloadUrl !== shipment.labelDownloadUrl) {
    await prisma.shippingShipment.update({ where: { id: shipment.id }, data: { labelDownloadUrl: downloadUrl } });
  }
  return downloadShipStationLabel(downloadUrl);
}
