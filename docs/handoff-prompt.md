# HappyTides Ops - Complete Handoff Prompt

Use this document to bring a completely new AI conversation up to speed.

## Copy/Paste Prompt For The New AI

You are taking over work on a local Next.js app called **HappyTides Ops**.

Important: the actual app is not in the current conversation wrapper folder. The real project directory is:

```text
/Users/aidanrasul/Documents/Codex/2026-06-08/you-are-building-a-premium-internal-2
```

Do not assume the app lives in:

```text
/Users/aidanrasul/Documents/Codex/2026-07-05/before-making-any-changes-completely-inspect
```

That second path is only the Codex conversation/work/output wrapper.

Your job is to continue from the existing working tree exactly as it is. Do not reset, revert, rewrite, or discard any existing changes unless I explicitly ask. There are many uncommitted changes that are intentional. Read the code first, then make scoped edits.

## User Preference / Working Style

The user wants high-effort, efficient, no-mistakes implementation. They care about:

- the app actually running locally
- all visible frontend workflows being functional
- useful business/operator information, not filler metrics
- preserving what already works
- not doing unnecessary rewrites
- using browser verification/screenshots when UI behavior matters
- localhost port `3001`

If asked to make changes, implement them directly. Do not stop at a plan unless explicitly asked.

## App Summary

HappyTides Ops is a premium internal operations dashboard for an in-person wholesale/sales workflow. It covers:

- overview dashboard
- order entry and order management
- customers
- products/catalog
- inventory batches/lots
- affiliates/referrals
- business analytics
- settings/auth shell
- API routes for all core resources
- Prisma/PostgreSQL schema and migrations
- offline/local fallback store for dev when the database is unavailable

Stack:

- Next.js App Router
- TypeScript
- React 19
- Tailwind CSS
- local shadcn-style UI components
- Prisma
- Recharts
- lucide-react
- Auth/session utilities

Run commands from:

```bash
cd /Users/aidanrasul/Documents/Codex/2026-06-08/you-are-building-a-premium-internal-2
npm install
npm run dev -- -p 3001
```

Validation commands:

```bash
npm run typecheck
npm run lint
npm test
```

Known verified status as of the previous handoff:

- `npm run typecheck` passed
- `npm run lint` passed
- browser-tested on `http://localhost:3001`
- dev server was running on port `3001` during the prior session

## Important Current State

The working tree is dirty and that is expected. Do not interpret the dirty state as accidental. It contains intentional implementation work from the previous AI session.

Notable modified/added areas include:

- `.env.example`
- `.gitignore`
- `README.md`
- `app/page.tsx`
- `app/analytics/page.tsx`
- `app/orders/page.tsx`
- `app/orders/new/page.tsx`
- `app/inventory/page.tsx`
- `app/products/page.tsx`
- `app/customers/page.tsx`
- `app/affiliates/page.tsx`
- `app/api/*`
- `components/app-shell.tsx`
- `components/data-table.tsx`
- `components/inventory-workbench.tsx`
- `components/manual-order-form.tsx`
- `components/metric-card.tsx`
- `components/orders-workbench.tsx`
- `lib/auth.ts`
- `lib/live-metrics.ts`
- `lib/local-store.ts`
- `lib/offline-store.ts`
- `lib/services/*`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/20260705090000_foundation_hardening/migration.sql`
- `scripts/import-local-store.ts`
- `tests/inventory-policy.test.ts`
- `types/domain.ts`

There may also be generated/local files such as:

- `.DS_Store`
- `.npm-cache/`
- `tsconfig.tsbuildinfo`
- `work/`

Be careful with these. Do not clean or delete them unless the user explicitly asks.

## What Was Recently Fixed

### 1. Overview metrics now use useful/live stats

File:

```text
app/page.tsx
```

The overview dashboard was improved so the tiles show meaningful operator information. It includes metrics like:

- Revenue today
- Orders today
- Average order
- Inventory risk
- Revenue month
- Top today
- Top week
- Repeat signal

The metric grid was adjusted so cards do not look cramped:

```tsx
<div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
```

The browser was used to verify that the overview page showed the owner account, non-cramped cards, and live revenue after orders were added.

### 2. Analytics page was rebuilt around useful operations data

File:

```text
app/analytics/page.tsx
```

The analytics page was rewritten away from filler/gross-margin-style metrics. It now focuses on:

- Revenue today
- Revenue week
- Units week
- Inventory risk
- Average order
- Revenue month
- Active customers
- Locations
- Sales trend chart
- Sales by location
- Products to watch
- Customer follow-up
- Recent order activity
- Operational exceptions

Important: browser verification confirmed the analytics page no longer showed "gross margin" text.

The current analytics headings are:

```text
Business intelligence
Sales trend
Sales by location
Products to watch
Customer follow-up
Recent order activity
Operational exceptions
```

### 3. Revenue today/statistics were made live

File:

```text
lib/live-metrics.ts
```

`getAnalyticsSummaryFromStore` was expanded with live fields:

- `revenueTodayCents`
- `revenueWeekCents`
- `revenueMonthCents`
- `ordersToday`
- `ordersWeek`
- `unitsToday`
- `unitsWeek`
- `aovTodayCents`
- `topToday`
- `topWeek`
- `activeCustomers`
- `locationSales`
- `recentOrders`

The visible-order logic filters out placeholder/canceled orders so canceled or dummy records do not pollute metrics.

### 4. New order submit returns to the page it came from

File:

```text
components/manual-order-form.tsx
```

The new order form reads the `returnTo` query param:

```ts
const returnTo = searchParams.get("returnTo") ?? "/orders";
```

On successful submit it performs a hard navigation:

```ts
window.location.assign(returnTo);
```

This matters because the user specifically asked: when clicking `+ New order`, filling the order, and submitting, it should exit the form and return to the page they were on.

Browser verification performed:

- Started from `/analytics`
- Clicked `New order`
- Confirmed URL became `/orders/new?returnTo=%2Fanalytics`
- Selected a SKU
- Submitted with `Record order`
- Confirmed browser returned to `/analytics`
- Confirmed `Revenue today` and recent order activity updated immediately

### 5. Batch/Lot removed from Orders page/table

Files:

```text
components/orders-workbench.tsx
app/orders/page.tsx
```

The Orders table no longer has a `Batch/Lot` column. Current table headers verified in browser:

```text
Order
Customer
Affiliate
Location
Items
Payment
Type
Total
Status
Actions
```

Also cleaned the Orders page intro copy. It now says:

```text
Process in-person orders, record payment method, and keep inventory accurate.
```

Browser verification confirmed no visible `Batch/Lot` text in the Orders page.

Important nuance: inventory still keeps batch/lot details where they belong. Do not remove batch/lot from Inventory unless the user explicitly asks.

### 6. Inventory layout was adjusted earlier

File:

```text
components/inventory-workbench.tsx
```

The user asked for Inventory batches to appear above Reorder. That was already handled earlier.

Inventory batch/lot details remain appropriate on the Inventory page.

### 7. Offline/local dev fallback exists

Files:

```text
lib/offline-store.ts
lib/local-store.ts
app/api/*/route.ts
```

The app has a global in-memory offline store for local dev when PostgreSQL is unavailable. This is why the app can still be used locally without a database.

Important behavior:

- orders created in offline mode live in process memory
- restarting the dev server resets those orders
- browser test orders from the previous session may appear until the server restarts
- if the user wants clean demo data, restart the dev server

Do not mistake in-memory reset behavior for broken persistence. Real persistence requires configured PostgreSQL.

### 8. Auth/dev shell fix

File:

```text
lib/auth.ts
```

The dev auth fallback was adjusted so stale local cookies do not leave the UI looking signed out in offline dev mode. Browser verification showed:

```text
Account access
Owner
owner@happytides.local
```

## Important Files To Read First

Start here:

```text
package.json
README.md
app/layout.tsx
app/page.tsx
app/analytics/page.tsx
app/orders/page.tsx
app/orders/new/page.tsx
components/app-shell.tsx
components/manual-order-form.tsx
components/orders-workbench.tsx
components/inventory-workbench.tsx
components/metric-card.tsx
components/charts.tsx
lib/live-metrics.ts
lib/local-store.ts
lib/offline-store.ts
types/domain.ts
prisma/schema.prisma
```

Then inspect the API routes if changing behavior:

```text
app/api/orders/route.ts
app/api/dashboard/route.ts
app/api/analytics/route.ts
app/api/inventory/route.ts
app/api/customers/route.ts
app/api/products/route.ts
app/api/affiliates/route.ts
```

## Browser Verification Expectations

When UI changes are made, use the browser against:

```text
http://localhost:3001
```

Minimum smoke checks:

1. Overview loads and shows meaningful metrics.
2. Orders page loads.
3. Orders table has no Batch/Lot column.
4. `+ New order` from Orders returns to `/orders` after submit.
5. `+ New order` from Analytics returns to `/analytics` after submit.
6. Submitted orders update revenue/recent activity.
7. Analytics no longer contains gross-margin/filler analytics.
8. Inventory page still shows Inventory batches above reorder tools.
9. Typecheck and lint pass.

## Current Known Caveats

1. Offline/local data is in-memory unless PostgreSQL is configured.
2. Browser test orders may exist in the currently running local dev process.
3. Restarting the dev server clears those in-memory browser test orders.
4. The project has a large dirty working tree; do not clean it blindly.
5. Generated files like `.next`, `.npm-cache`, and `tsconfig.tsbuildinfo` do not need to be copied for a clean handoff, but the source working tree does.

## Exact Commands For Next AI

From the real app directory:

```bash
cd /Users/aidanrasul/Documents/Codex/2026-06-08/you-are-building-a-premium-internal-2
npm install
npm run dev -- -p 3001
```

In a second terminal:

```bash
cd /Users/aidanrasul/Documents/Codex/2026-06-08/you-are-building-a-premium-internal-2
npm run typecheck
npm run lint
npm test
```

If the dev server is already running on `3001`, do not start another one on the same port. Use the existing server or stop/restart it only if needed.

## Best Next-Step Behavior

If the user gives a new implementation spec:

1. Read the relevant files first.
2. Preserve the existing architecture and local offline fallback.
3. Make targeted changes.
4. Use browser verification for visible UI/workflow changes.
5. Run `npm run typecheck` and `npm run lint`.
6. Report what changed and what was verified.

Do not make broad rewrites unless the user explicitly asks.

## Answer To "How Do I Make An Identical Copy For Another AI Chat?"

The best thing to copy is the actual project folder, not the Codex conversation folder.

Copy this:

```text
/Users/aidanrasul/Documents/Codex/2026-06-08/you-are-building-a-premium-internal-2
```

Do not rely on copying only this:

```text
/Users/aidanrasul/Documents/Codex/2026-07-05/before-making-any-changes-completely-inspect
```

The second folder contains this handoff/output wrapper, not the app.

Best options:

### Option A - Same machine, new Codex/AI conversation

Start the new conversation and give it:

```text
Work in /Users/aidanrasul/Documents/Codex/2026-06-08/you-are-building-a-premium-internal-2
Read /Users/aidanrasul/Documents/Codex/2026-07-05/before-making-any-changes-completely-inspect/outputs/happytides-handoff-prompt.md first.
Run the app on localhost:3001.
Do not reset or discard uncommitted changes.
```

No folder copy is necessary if the new AI can access the same filesystem.

### Option B - Duplicate the project locally

Use a folder copy of the real app directory. You can skip generated/heavy folders and reinstall dependencies:

```bash
rsync -a \
  --exclude node_modules \
  --exclude .next \
  --exclude .npm-cache \
  --exclude tsconfig.tsbuildinfo \
  /Users/aidanrasul/Documents/Codex/2026-06-08/you-are-building-a-premium-internal-2/ \
  /Users/aidanrasul/Documents/Codex/happytides-ops-copy/
```

Then in the copy:

```bash
cd /Users/aidanrasul/Documents/Codex/happytides-ops-copy
npm install
npm run dev -- -p 3001
```

### Option C - Send to an external AI/tool

Zip or upload the real app folder, excluding generated/heavy folders:

```text
Exclude:
node_modules
.next
.npm-cache
tsconfig.tsbuildinfo
```

Include:

```text
app/
components/
lib/
prisma/
scripts/
tests/
types/
public/ if present
package.json
package-lock.json if present
README.md
.env.example
eslint.config.mjs
tsconfig.json
tailwind/postcss configs if present
```

Do not upload `.env` or real secrets to any external AI.

### Option D - Most robust developer workflow

Commit the current working state to git on a branch, then have the other AI work from that branch. This is the cleanest way to preserve the exact source state and make changes reviewable.

Suggested branch name:

```text
handoff/happytides-functional-ui
```

Only do this if the user wants a commit. Do not commit automatically unless asked.

