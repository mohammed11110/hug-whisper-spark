-- 1) Deactivate older promo subscriptions per user (keep only the latest promo redemption)
WITH ranked AS (
  SELECT s.id,
         row_number() OVER (
           PARTITION BY s.user_id
           ORDER BY s.current_period_end DESC NULLS LAST, s.created_at DESC
         ) AS rn
  FROM public.subscriptions s
  WHERE s.paddle_subscription_id LIKE 'promo_%'
    AND s.status = 'active'
)
UPDATE public.subscriptions s
   SET status = 'canceled',
       current_period_end = now(),
       canceled_at = now(),
       updated_at = now()
  FROM ranked r
 WHERE s.id = r.id AND r.rn > 1;

-- 2) Update redeem_promo_code to cancel prior promo subs before activating the new one
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

  -- Cancel any previous promo subscriptions for this user so the new code wins
  UPDATE public.subscriptions
     SET status = 'canceled',
         current_period_end = now(),
         canceled_at = now(),
         updated_at = now()
   WHERE user_id = _uid
     AND paddle_subscription_id LIKE 'promo_%'
     AND paddle_subscription_id <> ('promo_' || _row.code);

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