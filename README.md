# HappyTides Ops

Premium internal backend dashboard and in-person sales processing system for HappyTides, a peptide/longevity brand. The app is designed for staff and admins to process in-person orders, track customers, products, inventory, batches/lots, Square payment references, and operational analytics.

This MVP is intentionally sales, inventory, CRM, and operations focused. It does not provide medical advice or collect unnecessary medical information.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS with shadcn-style local components
- Prisma schema for PostgreSQL
- Auth.js-ready role model
- Recharts for dashboard and analytics charts
- Square webhook and sync service stubs

## Getting Started

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev -- -p 3001
```

Set `DATABASE_URL` to a PostgreSQL database before running migrations. To seed the first owner account, set `DEV_SEED_OWNER_EMAIL` and `DEV_SEED_OWNER_PASSWORD` in your local environment before `npm run prisma:seed`.

If any real credentials were previously present in local environment files, rotate them in the relevant external service. Environment files should contain placeholders locally and must not be committed.

## Access Model

The app uses database-backed staff users, bcrypt password hashes, signed random session tokens stored in PostgreSQL, and server-side RBAC guards. Seeded users are only created from explicit development seed environment variables.

Roles:

- Owner: everything, including settings
- Operations Admin: products, inventory, customers, orders, integrations, reports
- Sales: accounts/customers and order workflows
- Warehouse: inventory and fulfillment workflows
- Finance: payments, refunds, and finance reporting
- Viewer: dashboard and reports only
- Wholesale Portal: reserved for future customer portal access

## Key Files

- [docs/architecture.md](docs/architecture.md)
- [docs/implementation-plan.md](docs/implementation-plan.md)
- [prisma/schema.prisma](prisma/schema.prisma)
- [prisma/seed.ts](prisma/seed.ts)
- [app/page.tsx](app/page.tsx)

## Security Notes

- Secrets belong in environment variables only.
- Square webhook verification is centralized in `lib/square.ts`; webhook events are persisted and deduped in PostgreSQL.
- Square sync is disabled with a clear not-connected response until Square credentials and a real ingestion implementation are configured.
- Customer records avoid medical history, symptoms, protocols, or dosing advice.
- Sensitive mutations should call `writeAuditLog` and enforce `requirePermission`.
- Add route-level rate limiting before production deployment.
