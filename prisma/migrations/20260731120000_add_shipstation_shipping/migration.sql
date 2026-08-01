CREATE TYPE "OrderDeliveryMethod" AS ENUM ('SHIP', 'PICKUP');
CREATE TYPE "ShippingShipmentStatus" AS ENUM ('DRAFT', 'PURCHASING', 'COMPLETED', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'VOID_PENDING', 'VOIDED', 'ERROR', 'RECONCILING');

ALTER TABLE "orders"
  ADD COLUMN "delivery_method" "OrderDeliveryMethod" NOT NULL DEFAULT 'SHIP',
  ADD COLUMN "ship_to_name" TEXT,
  ADD COLUMN "ship_to_company" TEXT,
  ADD COLUMN "ship_to_line1" TEXT,
  ADD COLUMN "ship_to_line2" TEXT,
  ADD COLUMN "ship_to_city" TEXT,
  ADD COLUMN "ship_to_region" TEXT,
  ADD COLUMN "ship_to_postal_code" TEXT,
  ADD COLUMN "ship_to_country" TEXT DEFAULT 'US',
  ADD COLUMN "ship_to_phone" TEXT,
  ADD COLUMN "ship_to_email" TEXT,
  ADD COLUMN "ship_to_residential" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "customer_shipping_addresses" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "recipient_name" TEXT NOT NULL,
  "company" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "postal_code" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'US',
  "phone" TEXT,
  "email" TEXT,
  "residential" BOOLEAN NOT NULL DEFAULT true,
  "is_default" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "customer_shipping_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipping_config" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "provider" TEXT NOT NULL DEFAULT 'shipstation',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "warehouse_id" TEXT,
  "enabled_carrier_ids" JSONB,
  "default_package_code" TEXT NOT NULL DEFAULT 'package',
  "default_weight_oz" DECIMAL(10,2),
  "default_length_in" DECIMAL(10,2),
  "default_width_in" DECIMAL(10,2),
  "default_height_in" DECIMAL(10,2),
  "label_format" TEXT NOT NULL DEFAULT 'pdf',
  "label_layout" TEXT NOT NULL DEFAULT '4x6',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipping_shipments" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'shipstation',
  "status" "ShippingShipmentStatus" NOT NULL DEFAULT 'DRAFT',
  "active_key" TEXT,
  "external_shipment_id" TEXT NOT NULL,
    "provider_shipment_id" TEXT,
    "provider_rate_id" TEXT,
    "quoted_rates" JSONB,
    "provider_label_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "source_address_hash" TEXT NOT NULL,
    "carrier_id" TEXT,
  "carrier_code" TEXT,
  "service_code" TEXT,
  "service_name" TEXT,
  "package_code" TEXT NOT NULL DEFAULT 'package',
  "weight_oz" DECIMAL(10,2) NOT NULL,
  "length_in" DECIMAL(10,2) NOT NULL,
  "width_in" DECIMAL(10,2) NOT NULL,
  "height_in" DECIMAL(10,2) NOT NULL,
  "ship_to_name" TEXT NOT NULL,
  "ship_to_company" TEXT,
  "ship_to_line1" TEXT NOT NULL,
  "ship_to_line2" TEXT,
  "ship_to_city" TEXT NOT NULL,
  "ship_to_region" TEXT NOT NULL,
  "ship_to_postal_code" TEXT NOT NULL,
  "ship_to_country" TEXT NOT NULL DEFAULT 'US',
  "ship_to_phone" TEXT,
  "ship_to_email" TEXT,
  "ship_to_residential" BOOLEAN NOT NULL DEFAULT true,
  "postage_cost_cents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "tracking_number" TEXT,
  "tracking_url" TEXT,
  "tracking_status" TEXT NOT NULL DEFAULT 'unknown',
  "tracking_detail" TEXT,
  "label_format" TEXT NOT NULL DEFAULT 'pdf',
  "label_layout" TEXT NOT NULL DEFAULT '4x6',
  "label_download_url" TEXT,
  "estimated_delivery_at" TIMESTAMP(3),
  "shipped_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "void_response" JSONB,
    "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipping_events" (
  "id" TEXT NOT NULL,
  "provider_event_key" TEXT NOT NULL,
  "shipment_id" TEXT,
  "event_type" TEXT NOT NULL,
  "tracking_number" TEXT,
  "status_code" TEXT,
  "status_detail" TEXT,
  "occurred_at" TIMESTAMP(3),
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_shipping_addresses_customer_id_is_default_idx" ON "customer_shipping_addresses"("customer_id", "is_default");
CREATE UNIQUE INDEX "shipping_shipments_active_key_key" ON "shipping_shipments"("active_key");
CREATE UNIQUE INDEX "shipping_shipments_external_shipment_id_key" ON "shipping_shipments"("external_shipment_id");
CREATE UNIQUE INDEX "shipping_shipments_provider_shipment_id_key" ON "shipping_shipments"("provider_shipment_id");
CREATE UNIQUE INDEX "shipping_shipments_provider_label_id_key" ON "shipping_shipments"("provider_label_id");
CREATE INDEX "shipping_shipments_order_id_created_at_idx" ON "shipping_shipments"("order_id", "created_at");
CREATE INDEX "shipping_shipments_tracking_number_idx" ON "shipping_shipments"("tracking_number");
CREATE INDEX "shipping_shipments_status_updated_at_idx" ON "shipping_shipments"("status", "updated_at");
CREATE UNIQUE INDEX "shipping_events_provider_event_key_key" ON "shipping_events"("provider_event_key");
CREATE INDEX "shipping_events_shipment_id_created_at_idx" ON "shipping_events"("shipment_id", "created_at");

ALTER TABLE "customer_shipping_addresses" ADD CONSTRAINT "customer_shipping_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipping_shipments" ADD CONSTRAINT "shipping_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipping_shipments" ADD CONSTRAINT "shipping_shipments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipping_events" ADD CONSTRAINT "shipping_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipping_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_shipping_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_events" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "customer_shipping_addresses" FROM anon, authenticated;
REVOKE ALL ON TABLE "shipping_config" FROM anon, authenticated;
REVOKE ALL ON TABLE "shipping_shipments" FROM anon, authenticated;
REVOKE ALL ON TABLE "shipping_events" FROM anon, authenticated;
