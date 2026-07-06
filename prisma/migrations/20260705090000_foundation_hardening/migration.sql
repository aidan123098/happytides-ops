-- Foundation hardening: auth, RBAC, account scaffolding, auditability, and operational state.

ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'OPERATIONS_ADMIN';
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'SALES';
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'WAREHOUSE';
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'WHOLESALE_PORTAL';

ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'EXPECTED';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'PENDING_QA';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'QA_RELEASED';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'RECALLED';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'DESTROYED';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'INITIAL_RECEIPT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'PURCHASE_RECEIPT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'MANUAL_ADJUSTMENT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'CYCLE_COUNT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_RESERVATION';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_ALLOCATION';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_FULFILLMENT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_CANCELLATION';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'RETURN_RECEIPT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'DAMAGE';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'SAMPLE';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'QUARANTINE';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'RELEASE';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'RECALL';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'DESTRUCTION';

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ACH';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'WIRE';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHECK';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ACCOUNT_CREDIT';

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'OVERPAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_ALLOCATED';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'ALLOCATED';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'PICKING';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'PACKED';

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'ACCOUNT';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'CONTACT';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'REFUND';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'AFFILIATE';

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'QUOTE_SENT', 'AWAITING_APPROVAL', 'AWAITING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'ALLOCATED', 'PICKING', 'PACKING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'ON_HOLD', 'CANCELED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'RETURNED');
CREATE TYPE "AccountType" AS ENUM ('RETAIL_CUSTOMER', 'WHOLESALE_ACCOUNT', 'DISTRIBUTOR', 'SUPPLIER', 'INTERNAL');
CREATE TYPE "AccountStatus" AS ENUM ('LEAD', 'PENDING_APPROVAL', 'ACTIVE', 'ON_HOLD', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "DocumentType" AS ENUM ('COA', 'SDS', 'INVOICE', 'PACKING_SLIP', 'PURCHASE_ORDER', 'CONTRACT', 'RESALE_CERTIFICATE', 'QUALITY_RECORD', 'OTHER');
CREATE TYPE "DocumentVisibility" AS ENUM ('INTERNAL_ONLY', 'WHOLESALE_PORTAL', 'PUBLIC_QR');
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'REVOKED', 'ARCHIVED');

ALTER TABLE "users"
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "display_name" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "last_login_at" TIMESTAMP(3),
  ADD COLUMN "last_active_at" TIMESTAMP(3),
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mfa_methods" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "secret_hash" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "mfa_methods_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mfa_methods_user_id_enabled_idx" ON "mfa_methods"("user_id", "enabled");
ALTER TABLE "mfa_methods" ADD CONSTRAINT "mfa_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "login_attempts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "email" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");
CREATE INDEX "login_attempts_user_id_created_at_idx" ON "login_attempts"("user_id", "created_at");
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "user_activities" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_activities_user_id_created_at_idx" ON "user_activities"("user_id", "created_at");
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "price_lists" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "price_lists_name_key" ON "price_lists"("name");

CREATE TABLE "contacts" (
  "id" TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "title" TEXT,
  "communication_preference" TEXT,
  "sms_consent" BOOLEAN NOT NULL DEFAULT false,
  "email_consent" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");
CREATE INDEX "contacts_last_name_first_name_idx" ON "contacts"("last_name", "first_name");

CREATE TABLE "accounts" (
  "id" TEXT NOT NULL,
  "account_number" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL DEFAULT 'RETAIL_CUSTOMER',
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "primary_contact_id" TEXT,
  "assigned_sales_rep_id" TEXT,
  "price_list_id" TEXT,
  "payment_terms" TEXT,
  "credit_limit_cents" INTEGER NOT NULL DEFAULT 0,
  "current_balance_cents" INTEGER NOT NULL DEFAULT 0,
  "lifetime_revenue_cents" INTEGER NOT NULL DEFAULT 0,
  "lifetime_gross_profit_cents" INTEGER NOT NULL DEFAULT 0,
  "order_count" INTEGER NOT NULL DEFAULT 0,
  "first_order_at" TIMESTAMP(3),
  "last_order_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_account_number_key" ON "accounts"("account_number");
CREATE UNIQUE INDEX "accounts_primary_contact_id_key" ON "accounts"("primary_contact_id");
CREATE INDEX "accounts_name_idx" ON "accounts"("name");
CREATE INDEX "accounts_type_status_idx" ON "accounts"("type", "status");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_primary_contact_id_fkey" FOREIGN KEY ("primary_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_assigned_sales_rep_id_fkey" FOREIGN KEY ("assigned_sales_rep_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customers"
  ADD COLUMN "account_id" TEXT,
  ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "customers" ADD CONSTRAINT "customers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "account_contacts" (
  "account_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "role" TEXT,
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_contacts_pkey" PRIMARY KEY ("account_id", "contact_id")
);
ALTER TABLE "account_contacts" ADD CONSTRAINT "account_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_contacts" ADD CONSTRAINT "account_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "addresses" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT NOT NULL,
  "region" TEXT,
  "postal_code" TEXT,
  "country" TEXT NOT NULL DEFAULT 'US',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "addresses_account_id_type_idx" ON "addresses"("account_id", "type");
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "internal_sku" TEXT,
  ADD COLUMN "internal_notes" TEXT,
  ADD COLUMN "unit_of_measure" TEXT,
  ADD COLUMN "wholesale_price_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minimum_order_quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "reorder_point" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reorder_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "shelf_life_days" INTEGER,
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "archived_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

CREATE TABLE "price_list_items" (
  "id" TEXT NOT NULL,
  "price_list_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "min_quantity" INTEGER NOT NULL DEFAULT 1,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "price_list_items_price_list_id_product_id_min_quantity_key" ON "price_list_items"("price_list_id", "product_id", "min_quantity");
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "documents" (
  "id" TEXT NOT NULL,
  "type" "DocumentType" NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "DocumentVisibility" NOT NULL DEFAULT 'INTERNAL_ONLY',
  "title" TEXT NOT NULL,
  "file_name" TEXT,
  "mime_type" TEXT,
  "file_size" INTEGER,
  "storage_key" TEXT,
  "checksum" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "product_id" TEXT,
  "uploaded_by_id" TEXT,
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "documents_type_status_idx" ON "documents"("type", "status");
CREATE INDEX "documents_product_id_idx" ON "documents"("product_id");
ALTER TABLE "documents" ADD CONSTRAINT "documents_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "account_documents" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "account_documents_account_id_document_id_key" ON "account_documents"("account_id", "document_id");
ALTER TABLE "account_documents" ADD CONSTRAINT "account_documents_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_documents" ADD CONSTRAINT "account_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "account_activities" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "account_activities_account_id_created_at_idx" ON "account_activities"("account_id", "created_at");
ALTER TABLE "account_activities" ADD CONSTRAINT "account_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_batches"
  ADD COLUMN "released_at" TIMESTAMP(3),
  ADD COLUMN "released_by_id" TEXT,
  ADD COLUMN "quarantine_reason" TEXT,
  ADD COLUMN "hold_reason" TEXT,
  ADD COLUMN "recall_status" TEXT,
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE TABLE "lot_documents" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lot_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lot_documents_batch_id_document_id_key" ON "lot_documents"("batch_id", "document_id");
ALTER TABLE "lot_documents" ADD CONSTRAINT "lot_documents_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_documents" ADD CONSTRAINT "lot_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
  ADD COLUMN "quantity_before" INTEGER,
  ADD COLUMN "quantity_after" INTEGER,
  ADD COLUMN "reference_type" TEXT,
  ADD COLUMN "reference_id" TEXT;

CREATE TABLE "affiliates" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "code" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "revenue_generated_cents" INTEGER NOT NULL DEFAULT 0,
  "payout_rate_bps" INTEGER NOT NULL DEFAULT 0,
  "total_payout_cents" INTEGER NOT NULL DEFAULT 0,
  "payout_due_cents" INTEGER NOT NULL DEFAULT 0,
  "referred_customers" INTEGER NOT NULL DEFAULT 0,
  "referred_orders" INTEGER NOT NULL DEFAULT 0,
  "last_payout_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates"("code");
CREATE INDEX "affiliates_status_idx" ON "affiliates"("status");

ALTER TABLE "orders"
  ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'PAID',
  ADD COLUMN "account_id" TEXT,
  ADD COLUMN "order_source" TEXT,
  ADD COLUMN "affiliate_id" TEXT,
  ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE TABLE "square_sync_runs" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "error" TEXT,
  "catalog_items_checked" INTEGER NOT NULL DEFAULT 0,
  "payments_checked" INTEGER NOT NULL DEFAULT 0,
  "orders_checked" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "square_sync_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "square_sync_runs_status_started_at_idx" ON "square_sync_runs"("status", "started_at");
