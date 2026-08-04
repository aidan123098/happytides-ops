# Affiliate integration

The website and operations dashboard share the same Supabase project. The website owns registration, customer-account setup, affiliate applications, referral capture, and paid-order ingestion. The dashboard reads and manages those same records.

## Website application flow

An applicant must already be authenticated and linked to an active `storefront.customer_accounts` row. Account creation is handled by the website through its existing account RPCs.

Submit the requested code with the authenticated user's Supabase client:

```ts
const { data, error } = await supabase.rpc("storefront_request_affiliate", {
  p_code: requestedCode
});
```

The RPC accepts 3-20 letters or numbers and normalizes the code to uppercase. It creates or restores:

- `public.affiliates`: name, code, `affiliate_type = 'online'`, Pending status, and summary fields.
- `storefront.affiliate_accounts`: the authenticated website user-to-affiliate link and submission time.

The website must not submit or directly write approval status, affiliate type, commission rates, totals, payouts, or attribution ledgers.

Name, email, and phone remain authoritative in the existing customer account:

```text
affiliate_accounts.user_id
  -> customer_accounts.user_id
  -> customer_accounts.customer_id
  -> public.customers
```

The dashboard uses the presence of `affiliate_accounts` to label the record `Website`, displays the live customer contact values, and treats every website applicant as `Online`.

## Application status

Use the existing account response:

```ts
const { data, error } = await supabase.rpc("storefront_get_my_account");
const partner = data?.partner;
```

`partner.status` is one of `none`, `pending`, `active`, `paused`, or `declined`. A declined code is released. Calling `storefront_request_affiliate` again restores the same linked affiliate record to Pending with the newly requested code while dashboard audit history remains intact.

## Referral capture

The existing website flow remains authoritative:

1. Resolve a code with `resolve_storefront_affiliate_code`.
2. Record a visit with `record_storefront_affiliate_click`.
3. Preserve the code, capture time, visitor hash, and source through checkout.
4. Include these existing fields in the paid-order ingestion payload:

```ts
{
  affiliateCode,
  affiliateCapturedAt,
  affiliateVisitorHash,
  affiliateSource: "link" // or "manual"
}
```

`ingest_storefront_paid_order` validates the active code, attribution window, linked customer, and self-referral rule before writing the existing referral and commission ledgers.

## Dashboard behavior

- Website applications are detected from `storefront.affiliate_accounts`; staff records have no account link.
- Website status values are displayed as `approved -> Active`, `disabled -> Paused`, and `rejected -> Declined`.
- Commission detail comes from `admin_storefront_commissions` and existing refund records.
- Monthly payouts use `prepare_storefront_payouts` and `mark_storefront_payout_paid`.
- Orders entered through the dashboard call `sync_dashboard_affiliate_commission` so they use the same ledger and first/repeat program rates.
- Website contact details are not copied into affiliate-specific fields.

## Dashboard-only addition

The only new affiliate profile field is `public.affiliates.affiliate_type`, restricted to `online`, `wholesale`, or `influencer`. Website applications always default to `online`; dashboard staff may classify staff-created affiliates with any of the three values.

Social handles, contact overrides, partial payouts, payout voiding, and affiliate credit tracking are not currently persisted.
