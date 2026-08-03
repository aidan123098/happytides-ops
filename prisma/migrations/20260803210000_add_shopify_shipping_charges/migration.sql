ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'SHOPIFY';

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "shipping_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "shopify_order_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_shopify_order_id_key"
  ON "orders"("shopify_order_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_shipping_cents_nonnegative"
  CHECK ("shipping_cents" >= 0);
