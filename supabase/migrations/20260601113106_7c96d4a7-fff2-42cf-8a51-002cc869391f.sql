-- Update redeem_promo_code to also create a synthetic subscriptions row
-- so the UI (which reads from subscriptions/user_active_plan) reflects the plan.
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.promo_codes%ROWTYPE;
  _new_expiry timestamptz;
  _current_expiry timestamptz;
  _product text;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _row FROM public.promo_codes
   WHERE upper(code) = upper(_code) FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF _row.used_count >= _row.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_expired');
  END IF;

  SELECT subscription_expires_at INTO _current_expiry FROM public.profiles WHERE id = _uid;
  _new_expiry := GREATEST(COALESCE(_current_expiry, now()), now()) + (_row.duration_days || ' days')::interval;

  UPDATE public.profiles
     SET subscription_plan = _row.plan,
         subscription_status = 'active',
         subscription_expires_at = _new_expiry,
         updated_at = now()
   WHERE id = _uid;

  -- Mirror into subscriptions so useSubscription/user_active_plan see it
  _product := 'amlaki_' || _row.plan;

  INSERT INTO public.subscriptions (
    user_id, paddle_subscription_id, paddle_customer_id,
    product_id, price_id, status, environment,
    current_period_start, current_period_end
  ) VALUES (
    _uid,
    'promo_' || _row.code,
    'promo_customer',
    _product,
    'promo_' || _row.plan,
    'active',
    'live',
    now(),
    _new_expiry
  )
  ON CONFLICT (paddle_subscription_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        product_id = EXCLUDED.product_id,
        price_id = EXCLUDED.price_id,
        status = 'active',
        environment = 'live',
        current_period_end = EXCLUDED.current_period_end,
        canceled_at = NULL,
        grace_started_at = NULL,
        data_delete_at = NULL,
        updated_at = now();

  UPDATE public.promo_codes
     SET used_count = used_count + 1,
         redeemed_by = _uid,
         redeemed_at = now()
   WHERE id = _row.id;

  RETURN jsonb_build_object(
    'success', true,
    'plan', _row.plan,
    'expires_at', _new_expiry
  );
END;
$function$;

-- Backfill: create subscription row for already-redeemed promo codes that have no mirrored sub.
INSERT INTO public.subscriptions (
  user_id, paddle_subscription_id, paddle_customer_id,
  product_id, price_id, status, environment,
  current_period_start, current_period_end
)
SELECT
  pc.redeemed_by,
  'promo_' || pc.code,
  'promo_customer',
  'amlaki_' || pc.plan,
  'promo_' || pc.plan,
  'active',
  'live',
  COALESCE(pc.redeemed_at, now()),
  COALESCE(pc.redeemed_at, now()) + (pc.duration_days || ' days')::interval
FROM public.promo_codes pc
WHERE pc.redeemed_by IS NOT NULL
ON CONFLICT (paddle_subscription_id) DO NOTHING;