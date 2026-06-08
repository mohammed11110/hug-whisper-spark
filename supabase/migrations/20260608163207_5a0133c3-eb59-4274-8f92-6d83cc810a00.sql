
CREATE OR REPLACE FUNCTION public.admin_financial_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _mrr numeric := 0;
  _paid_users int := 0;
  _total_users int := 0;
  _new_30 int := 0;
  _canceled_30 int := 0;
  _price_map jsonb := jsonb_build_object(
    'starter_monthly', 9.99,
    'starter_yearly', 99.5/12,
    'pro_monthly', 19.99,
    'pro_yearly', 199/12.0,
    'business_monthly', 39.99,
    'business_yearly', 398.5/12,
    'enterprise_monthly', 79.99,
    'enterprise_yearly', 797/12.0
  );
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- MRR: sum monthly-normalized price of active/trialing live, non-promo subs
  SELECT COALESCE(SUM(COALESCE((_price_map ->> s.price_id)::numeric, 0)), 0),
         COUNT(DISTINCT s.user_id)
    INTO _mrr, _paid_users
    FROM public.subscriptions s
   WHERE s.environment = 'live'
     AND s.status IN ('active','trialing','past_due')
     AND s.paddle_subscription_id NOT LIKE 'promo_%'
     AND (s.current_period_end IS NULL OR s.current_period_end > now())
     AND (_price_map ? s.price_id);

  SELECT COUNT(*) INTO _total_users FROM public.profiles;
  SELECT COUNT(*) INTO _new_30 FROM public.profiles WHERE created_at > now() - interval '30 days';
  SELECT COUNT(*) INTO _canceled_30
    FROM public.subscriptions
   WHERE environment = 'live'
     AND canceled_at IS NOT NULL
     AND canceled_at > now() - interval '30 days';

  RETURN jsonb_build_object(
    'mrr', _mrr,
    'paid_users', _paid_users,
    'arpu', CASE WHEN _paid_users > 0 THEN _mrr / _paid_users ELSE 0 END,
    'total_users', _total_users,
    'new_users_30d', _new_30,
    'canceled_30d', _canceled_30,
    'conversion_rate', CASE WHEN _total_users > 0 THEN (_paid_users::numeric / _total_users) ELSE 0 END,
    'churn_rate', CASE WHEN (_paid_users + _canceled_30) > 0
                       THEN (_canceled_30::numeric / (_paid_users + _canceled_30)) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_financial_stats() TO authenticated;
