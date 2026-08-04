ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS affiliate_type text NOT NULL DEFAULT 'online';

UPDATE public.affiliates
SET affiliate_type = 'online'
WHERE affiliate_type IS NULL
   OR affiliate_type NOT IN ('online', 'wholesale', 'influencer');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliates_affiliate_type_check'
      AND conrelid = 'public.affiliates'::regclass
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT affiliates_affiliate_type_check
      CHECK (affiliate_type IN ('online', 'wholesale', 'influencer'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_storefront_commissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_approved integer;
  v_reversed integer;
BEGIN
  UPDATE storefront.affiliate_commissions c
  SET status = 'reversed', reversed_cents = c.amount_cents, updated_at = now()
  FROM public.orders o
  WHERE o.id = c.order_id
    AND c.status <> 'paid'
    AND (
      o.archived_at IS NOT NULL
      OR o.status IN ('CANCELED'::public."OrderStatus", 'REFUNDED'::public."OrderStatus")
      OR o.payment_status IN (
        'REFUNDED'::public."PaymentStatus",
        'CANCELED'::public."PaymentStatus",
        'VOIDED'::public."PaymentStatus"
      )
    );
  GET DIAGNOSTICS v_reversed = ROW_COUNT;

  UPDATE storefront.affiliate_commissions c
  SET status = 'approved', eligible_at = coalesce(c.eligible_at, now()), updated_at = now()
  FROM public.orders o
  WHERE o.id = c.order_id
    AND c.status = 'pending'
    AND o.status IN ('DELIVERED'::public."OrderStatus", 'COMPLETED'::public."OrderStatus")
    AND o.payment_status = 'PAID'::public."PaymentStatus";
  GET DIAGNOSTICS v_approved = ROW_COUNT;

  UPDATE public.affiliates a
  SET revenue_generated_cents = s.revenue_cents,
      payout_due_cents = s.due_cents,
      total_payout_cents = s.paid_cents,
      referred_orders = s.order_count,
      referred_customers = s.customer_count,
      updated_at = timezone('utc', now())
  FROM (
    SELECT a0.id AS affiliate_id,
      coalesce(sum(CASE WHEN c.status <> 'reversed' THEN c.commissionable_cents ELSE 0 END), 0)::integer AS revenue_cents,
      coalesce(sum(CASE WHEN c.status IN ('pending', 'approved') THEN c.amount_cents - c.reversed_cents ELSE 0 END), 0)::integer AS due_cents,
      coalesce(sum(CASE WHEN c.status = 'paid' THEN c.amount_cents - c.reversed_cents ELSE 0 END), 0)::integer AS paid_cents,
      count(c.id) FILTER (WHERE c.status <> 'reversed')::integer AS order_count,
      count(DISTINCT c.customer_id) FILTER (WHERE c.status <> 'reversed')::integer AS customer_count
    FROM public.affiliates a0
    LEFT JOIN storefront.affiliate_commissions c ON c.affiliate_id = a0.id
    GROUP BY a0.id
  ) s
  WHERE a.id = s.affiliate_id;

  RETURN jsonb_build_object('approved', v_approved, 'reversed', v_reversed);
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_storefront_commissions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.refresh_storefront_commissions() TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.sync_dashboard_affiliate_commission(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_commission storefront.affiliate_commissions%ROWTYPE;
  v_affiliate_status text;
  v_program storefront.affiliate_program%ROWTYPE;
  v_attribution_id uuid;
  v_commission_type text;
  v_rate_bps integer;
  v_commissionable_cents integer;
  v_amount_cents integer;
  v_is_paid boolean;
  v_is_cancelled boolean;
BEGIN
  IF nullif(trim(coalesce(p_order_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Order ID is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('affiliate-order:' || p_order_id, 0));

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order was not found';
  END IF;

  SELECT * INTO v_commission
  FROM storefront.affiliate_commissions
  WHERE order_id = p_order_id
  FOR UPDATE;

  v_is_paid := upper(v_order.payment_status::text) IN ('PAID', 'OVERPAID');
  v_is_cancelled := v_order.archived_at IS NOT NULL
    OR upper(v_order.status::text) IN ('CANCELED', 'REFUNDED')
    OR upper(v_order.payment_status::text) IN ('REFUNDED', 'CANCELED', 'VOIDED');

  IF v_order.affiliate_id IS NOT NULL THEN
    SELECT lower(a.status) INTO v_affiliate_status
    FROM public.affiliates a
    WHERE a.id = v_order.affiliate_id
      AND a.archived_at IS NULL;
  END IF;

  IF v_order.affiliate_id IS NULL
     OR v_affiliate_status NOT IN ('active', 'approved')
     OR NOT v_is_paid
     OR v_is_cancelled THEN
    IF v_commission.id IS NULL THEN
      RETURN jsonb_build_object('synced', false, 'reason', 'not_eligible');
    END IF;

    IF v_commission.status = 'paid' OR v_commission.payout_id IS NOT NULL THEN
      IF NOT v_is_cancelled THEN
        RAISE EXCEPTION 'A paid affiliate commission cannot be changed or reassigned';
      END IF;
      PERFORM private.record_storefront_commission_refund(
        p_order_id,
        'dashboard-order-cancel:' || p_order_id,
        greatest(v_commission.commissionable_cents, 1)
      );
    ELSE
      UPDATE storefront.affiliate_commissions
      SET status = 'reversed', reversed_cents = amount_cents, updated_at = now()
      WHERE id = v_commission.id;
      PERFORM private.refresh_storefront_commissions();
    END IF;

    RETURN jsonb_build_object('synced', true, 'status', 'reversed');
  END IF;

  SELECT * INTO v_program
  FROM storefront.affiliate_program
  WHERE id = 'default' AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The affiliate program is not active';
  END IF;

  v_commissionable_cents := greatest(v_order.subtotal_cents - v_order.discount_cents, 0);

  INSERT INTO storefront.referral_attributions (
    affiliate_id, customer_id, order_id, visitor_hash, source, captured_at, expires_at, converted_at
  ) VALUES (
    v_order.affiliate_id,
    v_order.customer_id,
    v_order.id,
    NULL,
    'manual',
    v_order.created_at AT TIME ZONE 'UTC',
    (v_order.created_at AT TIME ZONE 'UTC') + make_interval(days => v_program.attribution_days),
    now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    affiliate_id = excluded.affiliate_id,
    customer_id = excluded.customer_id,
    source = 'manual',
    converted_at = excluded.converted_at
  RETURNING id INTO v_attribution_id;

  IF v_commission.id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.orders prior
      WHERE prior.customer_id = v_order.customer_id
        AND prior.id <> v_order.id
        AND prior.archived_at IS NULL
        AND prior.payment_status = 'PAID'::public."PaymentStatus"
        AND prior.status NOT IN ('CANCELED'::public."OrderStatus", 'REFUNDED'::public."OrderStatus")
        AND prior.created_at < v_order.created_at
    ) THEN
      v_commission_type := 'repeat';
      v_rate_bps := v_program.repeat_commission_bps;
    ELSE
      v_commission_type := 'first_order';
      v_rate_bps := v_program.first_order_commission_bps;
    END IF;

    v_amount_cents := round(v_commissionable_cents * v_rate_bps / 10000.0);
    INSERT INTO storefront.affiliate_commissions (
      affiliate_id, customer_id, order_id, attribution_id, commission_type, rate_bps,
      commissionable_cents, amount_cents, reversed_cents, status, earned_at
    ) VALUES (
      v_order.affiliate_id, v_order.customer_id, v_order.id, v_attribution_id, v_commission_type, v_rate_bps,
      v_commissionable_cents, v_amount_cents, 0, 'pending', v_order.created_at AT TIME ZONE 'UTC'
    );
  ELSE
    v_amount_cents := round(v_commissionable_cents * v_commission.rate_bps / 10000.0);
    IF (v_commission.status = 'paid' OR v_commission.payout_id IS NOT NULL)
       AND (
         v_commission.affiliate_id <> v_order.affiliate_id
         OR v_commission.customer_id <> v_order.customer_id
         OR v_commission.commissionable_cents <> v_commissionable_cents
         OR v_commission.amount_cents <> v_amount_cents
       ) THEN
      RAISE EXCEPTION 'A paid affiliate commission cannot be changed or reassigned';
    END IF;

    IF v_commission.status <> 'paid' AND v_commission.payout_id IS NULL THEN
      UPDATE storefront.affiliate_commissions
      SET affiliate_id = v_order.affiliate_id,
          customer_id = v_order.customer_id,
          attribution_id = v_attribution_id,
          commissionable_cents = v_commissionable_cents,
          amount_cents = v_amount_cents,
          reversed_cents = 0,
          status = 'pending',
          updated_at = now()
      WHERE id = v_commission.id;
    END IF;
  END IF;

  PERFORM private.refresh_storefront_commissions();
  RETURN jsonb_build_object('synced', true, 'status', 'recorded', 'orderId', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION private.sync_dashboard_affiliate_commission(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sync_dashboard_affiliate_commission(text) TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.sync_dashboard_affiliate_commission(p_order_id text)
RETURNS jsonb
LANGUAGE sql
SET search_path = ''
AS $$
  SELECT private.sync_dashboard_affiliate_commission(p_order_id);
$$;

REVOKE ALL ON FUNCTION public.sync_dashboard_affiliate_commission(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_dashboard_affiliate_commission(text) TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.review_storefront_affiliate(
  p_affiliate_id text,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text := lower(trim(coalesce(p_action, '')));
  v_code text;
BEGIN
  IF v_action NOT IN ('approved', 'rejected', 'disabled') THEN
    RAISE EXCEPTION 'Unsupported affiliate action';
  END IF;

  SELECT a.code INTO v_code
  FROM public.affiliates a
  WHERE a.id = p_affiliate_id
    AND EXISTS (
      SELECT 1 FROM storefront.affiliate_accounts aa
      WHERE aa.affiliate_id = a.id
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Storefront affiliate was not found';
  END IF;

  UPDATE public.affiliates a
  SET status = v_action,
      code = CASE
        WHEN v_action = 'rejected'
          THEN split_part(coalesce(v_code, 'DECLINED'), '__ARCHIVED__', 1) || '__ARCHIVED__' || p_affiliate_id
        ELSE a.code
      END,
      notes = coalesce(nullif(trim(p_notes), ''), a.notes),
      updated_at = timezone('utc', now())
  WHERE a.id = p_affiliate_id;

  UPDATE storefront.affiliate_accounts
  SET approved_at = CASE WHEN v_action = 'approved' THEN now() ELSE approved_at END,
      updated_at = now()
  WHERE affiliate_id = p_affiliate_id;

  RETURN jsonb_build_object(
    'affiliateId', p_affiliate_id,
    'status', v_action,
    'code', split_part(coalesce(v_code, ''), '__ARCHIVED__', 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION private.review_storefront_affiliate(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.review_storefront_affiliate(text, text, text) TO postgres, service_role;

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

  IF v_affiliate_id IS NOT NULL AND v_existing_status NOT IN ('rejected', 'declined', 'archived') THEN
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
      WHEN lower(a.status) IN ('declined', 'rejected', 'archived') THEN 'declined'
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
