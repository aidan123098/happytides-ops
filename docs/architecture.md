# HappyTides Ops Architecture

## Product Boundary

HappyTides Ops is an internal operating system for in-person sales, inventory, customers, orders, batches/lots, Square reconciliation, and business analytics. It deliberately avoids medical advice, treatment protocols, diagnosis, and unnecessary health data.

## System Shape

- `app/`: Next.js App Router pages and API route handlers.
- `components/`: shell, dashboard widgets, tables, forms, and shadcn-style primitives.
- `lib/`: domain data, auth/RBAC, Prisma client, analytics calculations, Square service stubs, validation.
- `prisma/`: PostgreSQL schema and seed data.
- `docs/`: architecture, route list, page list, and phased implementation plan.

## UI Page List

- `/login`: polished staff login screen.
- `/`: executive dashboard with revenue, AOV, units, repeat rate, product velocity, warnings, charts, and recent orders.
- `/products`: catalog management with SKU, category, strength, margin, COA, status, and inventory tracking.
- `/customers`: privacy-conscious CRM with customer value, source, consent, tags, and lifecycle status.
- `/affiliates`: affiliate revenue, payout due, payout rate, referred customer/order, and payout workflow tracking.
- `/orders`: manual order entry workflow, order table, payment status, fulfillment status, Square references, and batch/lot display.
- `/inventory`: batch-level stock, lot status, reorder risk, expiration risk, and adjustment feed.
- `/analytics`: sales, product, customer, and operations analytics views.
- `/settings`: roles, locations/events, Square connection status, security posture, and audit coverage.

## API Route List

- `GET /api/dashboard`: dashboard metrics, charts, warnings, recent orders.
- `GET /api/products`: product catalog.
- `POST /api/products`: create product.
- `GET /api/customers`: customer list and metrics.
- `POST /api/customers`: create customer.
- `GET /api/affiliates`: affiliate ledger and payout placeholders.
- `GET /api/orders`: order list.
- `POST /api/orders`: create manual order, allocate batch, decrement inventory, update customer stats, audit.
- `GET /api/inventory`: batch inventory and movement history.
- `POST /api/inventory`: manual adjustment with reason and audit.
- `GET /api/analytics`: sales, product, customer, and operations analytics.
- `POST /api/square/webhook`: signature verification and idempotent Square event capture.
- `POST /api/square/sync`: pull Square catalog/orders/payments and produce reconciliation candidates.

## Data Model

Core tables:

- `users`, `roles`, `user_roles`
- `customers`, `customer_tags`, `customer_tag_assignments`
- `product_categories`, `products`
- `inventory_batches`, `inventory_movements`
- `orders`, `order_items`, `payments`
- `square_events`
- `staff_locations`
- `audit_logs`
- `product_performance_snapshots`

Every major table has `created_at` and `updated_at`. Mutating operational flows also create audit records.

## Order Flow

1. Staff searches or creates a customer.
2. Staff adds products to cart.
3. The system checks available batch-level inventory.
4. Staff confirms or accepts recommended batch/lot.
5. Payment is recorded manually or imported from Square.
6. Paid orders decrement inventory and create `inventory_movements`.
7. Customer aggregates are updated.
8. Dashboard metrics and recent orders reflect the sale.

## Square Integration

The Square implementation is isolated behind `lib/square.ts`.

- Secrets use `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT`, `SQUARE_LOCATION_ID`, and `SQUARE_WEBHOOK_SIGNATURE_KEY`.
- Webhook handler verifies signatures, stores `square_events`, and checks idempotency before processing.
- Sync service stub returns catalog/payment/order reconciliation placeholders.
- Unmatched payments should flow into a reconciliation screen in Phase 2.

## Security Model

- Auth.js-ready user/session model.
- Role-based permissions in `lib/auth.ts`.
- Server route validation with Zod.
- Audit logs for inventory, product, order, customer, Square, and settings mutations.
- No secrets are exposed to the frontend.
- Customer PII is limited to operational contact and commerce fields.
- Production deployment should add rate limiting and PII encryption-at-rest policy where required.
