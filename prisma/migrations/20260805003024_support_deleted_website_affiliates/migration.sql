CREATE OR REPLACE FUNCTION private.storefront_request_affiliate(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_customer_id text;
  v_affiliate_id text;
  v_existing_status text;
  v_name text;
  v_code text := upper(trim(coalesce(p_code, '')));
BEGIN
  SELECT i.user_id INTO v_user_id
  FROM private.storefront_require_identity() i;

  IF v_code !~ '^[A-Z0-9]{3,20}$' THEN
    RAISE EXCEPTION 'Use 3-20 letters or numbers';
  END IF;

  SELECT a.customer_id INTO v_customer_id
  FROM storefront.customer_accounts a
  WHERE a.user_id = v_user_id
    AND a.status = 'active';

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Active customer account required' USING errcode = '42501';
  END IF;

  SELECT aa.affiliate_id, lower(af.status)
  INTO v_affiliate_id, v_existing_status
  FROM storefront.affiliate_accounts aa
  JOIN public.affiliates af ON af.id = aa.affiliate_id
  WHERE aa.user_id = v_user_id;

  IF v_affiliate_id IS NOT NULL AND v_existing_status NOT IN ('rejected', 'declined', 'archived', 'deleted') THEN
    RETURN private.storefront_get_my_account();
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE lower(a.code) = lower(v_code)
      AND a.archived_at IS NULL
      AND a.id IS DISTINCT FROM v_affiliate_id
  ) THEN
    RAISE EXCEPTION 'That partner code is already in use' USING errcode = '23505';
  END IF;

  SELECT trim(concat_ws(' ', c.first_name, c.last_name)) INTO v_name
  FROM public.customers c
  WHERE c.id = v_customer_id;

  IF v_affiliate_id IS NOT NULL THEN
    UPDATE public.affiliates
    SET name = v_name,
        code = v_code,
        status = 'pending',
        affiliate_type = 'online',
        notes = 'Customer-submitted website partner application.',
        archived_at = NULL,
        updated_at = timezone('utc', now())
    WHERE id = v_affiliate_id;

    UPDATE storefront.affiliate_accounts
    SET submitted_at = now(), approved_at = NULL, updated_at = now()
    WHERE user_id = v_user_id;
  ELSE
    v_affiliate_id := 'web_affiliate_' || replace(extensions.gen_random_uuid()::text, '-', '');
    INSERT INTO public.affiliates (
      id, name, code, affiliate_type, status, payout_rate_bps, notes, created_at, updated_at
    ) VALUES (
      v_affiliate_id, v_name, v_code, 'online', 'pending', 1000,
      'Customer-submitted website partner application.', timezone('utc', now()), timezone('utc', now())
    );
    INSERT INTO storefront.affiliate_accounts (user_id, affiliate_id)
    VALUES (v_user_id, v_affiliate_id);
  END IF;

  RETURN private.storefront_get_my_account();
END;
$$;

REVOKE ALL ON FUNCTION private.storefront_request_affiliate(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.storefront_request_affiliate(text) TO postgres, authenticated;

CREATE OR REPLACE FUNCTION private.storefront_get_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_customer_id text;
  v_account_status text;
  v_profile jsonb;
  v_address jsonb;
  v_orders jsonb := '[]'::jsonb;
  v_partner jsonb;
BEGIN
  SELECT i.user_id, i.email INTO v_user_id, v_email
  FROM private.storefront_require_identity() i;

  SELECT a.customer_id, a.status INTO v_customer_id, v_account_status
  FROM storefront.customer_accounts a
  WHERE a.user_id = v_user_id;

  IF v_account_status IS NULL THEN
    RETURN jsonb_build_object('status', 'needs_setup', 'email', v_email);
  END IF;
  IF v_account_status <> 'active' OR v_customer_id IS NULL THEN
    RETURN jsonb_build_object('status', v_account_status, 'email', v_email);
  END IF;

  SELECT jsonb_build_object(
    'name', trim(concat_ws(' ', c.first_name, c.last_name)),
    'email', v_email,
    'phone', coalesce(c.phone, ''),
    'memberSince', c.created_at
  ) INTO v_profile
  FROM public.customers c
  WHERE c.id = v_customer_id
    AND c.archived_at IS NULL;

  SELECT jsonb_build_object(
    'name', a.recipient_name,
    'line1', a.line1,
    'line2', coalesce(a.line2, ''),
    'city', a.city,
    'state', a.region,
    'zip', a.postal_code,
    'country', a.country
  ) INTO v_address
  FROM public.customer_shipping_addresses a
  WHERE a.customer_id = v_customer_id
    AND a.archived_at IS NULL
  ORDER BY a.is_default DESC, a.updated_at DESC, a.created_at DESC
  LIMIT 1;

  SELECT coalesce(jsonb_agg(o.payload ORDER BY o.created_at DESC), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT x.created_at, jsonb_build_object(
      'number', x.order_number,
      'date', x.created_at,
      'status', lower(x.status::text),
      'fulfillmentStatus', lower(x.fulfillment_status::text),
      'subtotalCents', x.subtotal_cents,
      'discountCents', x.discount_cents,
      'shippingCents', x.shipping_cents,
      'taxCents', x.tax_cents,
      'totalCents', x.total_cents,
      'payment', coalesce((
        SELECT initcap(lower(p.method::text))
        FROM public.payments p
        WHERE p.order_id = x.id AND p.archived_at IS NULL
        ORDER BY p.created_at DESC LIMIT 1
      ), coalesce(x.paid_to, '')),
      'trackingUrl', coalesce((
        SELECT s.tracking_url
        FROM public.shipping_shipments s
        WHERE s.order_id = x.id AND s.voided_at IS NULL
        ORDER BY s.created_at DESC LIMIT 1
      ), ''),
      'address', concat_ws(', ', nullif(x.ship_to_line1, ''), nullif(x.ship_to_line2, ''),
        nullif(x.ship_to_city, ''), nullif(concat_ws(' ', x.ship_to_region, x.ship_to_postal_code), '')),
      'items', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'name', p.name,
          'detail', p.strength_label,
          'slug', coalesce(p.slug, CASE p.id
            WHEN 'prod_glp3_rt_10' THEN 'glp3-rt'
            WHEN 'prod_bpc_157_10' THEN 'bpc-157'
            WHEN 'prod_tb_500_10' THEN 'tb-500'
            WHEN 'prod_cjc_1295_no_dac_10' THEN 'cjc-1295-no-dac'
            WHEN 'prod_tesamorelin_10' THEN 'tesamorelin'
            WHEN 'prod_ghk_cu_50' THEN 'ghk-cu'
            WHEN 'prod_mots_c_10' THEN 'mots-c'
            WHEN 'prod_nad_500' THEN 'nad-plus'
            WHEN 'prod_glow_blend' THEN 'glow-blend'
            WHEN 'prod_klow_blend' THEN 'klow-blend'
            WHEN 'prod_bac_water_30' THEN 'bac-water'
            ELSE ''
          END),
          'imageUrl', coalesce(p.image_url, ''),
          'qty', oi.quantity,
          'unitPriceCents', oi.unit_price_cents,
          'totalCents', oi.total_cents
        ) ORDER BY oi.created_at)
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = x.id
      ), '[]'::jsonb)
    ) AS payload
    FROM public.orders x
    WHERE x.customer_id = v_customer_id
      AND x.archived_at IS NULL
    ORDER BY x.created_at DESC
    LIMIT 50
  ) o;

  SELECT jsonb_build_object(
    'status', CASE
      WHEN lower(a.status) IN ('active', 'approved') THEN 'active'
      WHEN lower(a.status) IN ('paused', 'disabled') THEN 'paused'
      WHEN lower(a.status) IN ('declined', 'rejected', 'archived', 'deleted') THEN 'declined'
      ELSE 'pending'
    END,
    'code', split_part(coalesce(a.code, ''), '__ARCHIVED__', 1),
    'type', coalesce(a.affiliate_type, 'online'),
    'clicks', (SELECT count(*) FROM storefront.affiliate_clicks c WHERE c.affiliate_id = a.id),
    'orders', (SELECT count(*) FROM storefront.affiliate_commissions c WHERE c.affiliate_id = a.id AND c.status <> 'reversed'),
    'revenueCents', coalesce(a.revenue_generated_cents, 0),
    'pendingCents', (SELECT coalesce(sum(c.amount_cents - c.reversed_cents), 0) FROM storefront.affiliate_commissions c WHERE c.affiliate_id = a.id AND c.status IN ('pending', 'approved')),
    'paidCents', (SELECT coalesce(sum(c.amount_cents - c.reversed_cents), 0) FROM storefront.affiliate_commissions c WHERE c.affiliate_id = a.id AND c.status = 'paid'),
    'recent', (SELECT coalesce(jsonb_agg(r.payload ORDER BY r.earned_at DESC), '[]'::jsonb) FROM (
      SELECT c.earned_at, jsonb_build_object(
        'date', c.earned_at,
        'type', c.commission_type,
        'orderCents', c.commissionable_cents,
        'earnedCents', c.amount_cents - c.reversed_cents,
        'status', c.status
      ) AS payload
      FROM storefront.affiliate_commissions c
      WHERE c.affiliate_id = a.id
      ORDER BY c.earned_at DESC LIMIT 10
    ) r)
  ) INTO v_partner
  FROM storefront.affiliate_accounts aa
  JOIN public.affiliates a ON a.id = aa.affiliate_id
  WHERE aa.user_id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'active',
    'profile', v_profile,
    'address', coalesce(v_address, 'null'::jsonb),
    'orders', v_orders,
    'partner', coalesce(v_partner, jsonb_build_object('status', 'none'))
  );
END;
$$;

REVOKE ALL ON FUNCTION private.storefront_get_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.storefront_get_my_account() TO postgres, authenticated;
