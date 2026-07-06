# Implementation Plan

## Phase 1 MVP

- Authentication and roles: demo Auth.js-ready scaffolding, role constants, permission checks.
- Dashboard: KPI cards, revenue chart, product mix, staff/location sales, warnings, recent orders.
- Products: catalog table, margin, COA, disclaimer, active status, product accents.
- Customers: CRM table, consent, source, tags, value, lifecycle status.
- Orders: manual sales table and cart workflow scaffold.
- Inventory: batch/lot tracking, quantity, status, reorder and expiration warnings, adjustment feed.
- Basic analytics: sales, product, customer, and operations panels.

## Phase 2 Integrations

- Square webhook signature verification against production payloads.
- Idempotent event processing into `square_events`.
- Square order/payment import with internal customer matching.
- Reconciliation screen for unmatched payments.
- Batch traceability reports and CSV exports.
- More granular audit views.

## Phase 3 Growth

- SMS/email consent-based integrations.
- Predictive reorder suggestions.
- Staff performance and commission-ready reports.
- Customer segmentation and VIP cohorts.
- Scheduled owner reports.

## Production Hardening

- Replace demo auth with Auth.js providers or Clerk.
- Connect PostgreSQL through Supabase or Neon.
- Add route-level rate limiting.
- Add structured logging and alerting.
- Add encrypted backups and retention policy.
- Add e2e tests for order creation, Square webhook idempotency, inventory decrementing, and RBAC.
