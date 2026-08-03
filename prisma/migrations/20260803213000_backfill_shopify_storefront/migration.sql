DO $$
BEGIN
  IF to_regprocedure('private.ingest_storefront_paid_order(jsonb)') IS NOT NULL
     AND to_regprocedure('private.ingest_storefront_paid_order_base(jsonb)') IS NULL THEN
    EXECUTE 'ALTER FUNCTION private.ingest_storefront_paid_order(jsonb) RENAME TO ingest_storefront_paid_order_base';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION private.ingest_storefront_paid_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_order_id text;
  v_provider text := lower(trim(coalesce(p_payload->>'providerId', '')));
  v_payment_ref text := trim(coalesce(p_payload->>'paymentRef', ''));
  v_shipping_cents integer := coalesce((p_payload->>'shippingCents')::integer, 0);
  v_shopify_order_id text;
BEGIN
  v_result := private.ingest_storefront_paid_order_base(p_payload);
  v_order_id := nullif(v_result->>'orderId', '');

  IF v_order_id IS NULL THEN
    RETURN v_result;
  END IF;

  IF v_provider = 'shopify' THEN
    v_shopify_order_id := CASE
      WHEN v_payment_ref ~ '^[0-9]+$' THEN v_payment_ref
      WHEN v_payment_ref ~* '^gid://shopify/Order/[0-9]+$' THEN regexp_replace(v_payment_ref, '^gid://shopify/Order/', '', 'i')
      WHEN v_payment_ref ~* '^https://admin\.shopify\.com/store/happy-tides-ikkkdaq4/orders/[0-9]+/?$'
        THEN substring(v_payment_ref from '/orders/([0-9]+)/?$')
      ELSE NULL
    END;
  END IF;

  UPDATE public.orders
  SET shipping_cents = v_shipping_cents,
      shopify_order_id = CASE
        WHEN v_provider = 'shopify' THEN coalesce(v_shopify_order_id, shopify_order_id)
        ELSE shopify_order_id
      END
  WHERE id = v_order_id;

  IF v_provider = 'shopify' THEN
    UPDATE public.payments
    SET method = 'SHOPIFY'::public."PaymentMethod"
    WHERE order_id = v_order_id
      AND archived_at IS NULL;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_storefront_paid_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.ingest_storefront_paid_order(p_payload);
$$;

REVOKE ALL ON FUNCTION private.ingest_storefront_paid_order_base(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.ingest_storefront_paid_order(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.ingest_storefront_paid_order(jsonb) TO anon, service_role;
REVOKE ALL ON FUNCTION public.ingest_storefront_paid_order(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ingest_storefront_paid_order(jsonb) TO anon, service_role;

DO $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE order_number = 'HT-H8LO-A145'
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected Shopify order HT-H8LO-A145 was not found';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = v_order.id
    AND archived_at IS NULL
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected payment for Shopify order HT-H8LO-A145 was not found';
  END IF;

  IF v_order.shipping_cents = 999
     AND v_order.shopify_order_id = '7093822324971'
     AND v_payment.method = 'SHOPIFY'::public."PaymentMethod" THEN
    NULL;
  ELSE
    IF v_order.subtotal_cents <> 1500
       OR v_order.discount_cents <> 0
       OR v_order.tax_cents <> 0
       OR v_order.total_cents <> 2499
       OR v_order.shipping_cents <> 0
       OR v_order.shopify_order_id IS NOT NULL
       OR v_payment.amount_cents <> 2499
       OR v_payment.method <> 'OTHER'::public."PaymentMethod" THEN
      RAISE EXCEPTION 'Shopify order HT-H8LO-A145 changed unexpectedly; refusing metadata backfill';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.orders
      WHERE shopify_order_id = '7093822324971'
        AND id <> v_order.id
    ) THEN
      RAISE EXCEPTION 'Shopify order ID 7093822324971 is already assigned to another order';
    END IF;

    UPDATE public.orders
    SET shipping_cents = 999,
        shopify_order_id = '7093822324971'
    WHERE id = v_order.id;

    UPDATE public.payments
    SET method = 'SHOPIFY'::public."PaymentMethod"
    WHERE id = v_payment.id;
  END IF;
END
$$;
