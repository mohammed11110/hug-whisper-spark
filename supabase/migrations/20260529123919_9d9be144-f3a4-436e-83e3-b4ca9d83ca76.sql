-- 1. Add addon_units column to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS addon_units integer NOT NULL DEFAULT 0;

-- 2. Update plan unit limits (Personal=10, Pro=25, Business=75, Free=3)
CREATE OR REPLACE FUNCTION public.get_plan_unit_limit(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE _plan
    WHEN 'starter'    THEN 10  -- legacy alias for personal
    WHEN 'personal'   THEN 10
    WHEN 'pro'        THEN 25
    WHEN 'business'   THEN 75
    WHEN 'enterprise' THEN 2147483647  -- grandfathered legacy plan
    ELSE 3
  END;
$function$;

-- 3. Helper: get user's effective unit allowance (plan limit + add-on units)
CREATE OR REPLACE FUNCTION public.user_unit_allowance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH active_sub AS (
    SELECT s.product_id, s.addon_units
    FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND s.environment = 'live'
      AND (
        (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
      )
    ORDER BY s.created_at DESC
    LIMIT 1
  )
  SELECT public.get_plan_unit_limit(public.user_active_plan(_user_id))
       + COALESCE((SELECT addon_units FROM active_sub), 0);
$function$;

-- 4. Update quota enforcement to use plan + add-on units
CREATE OR REPLACE FUNCTION public.enforce_unit_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id uuid;
  _allowance integer;
  _current integer;
BEGIN
  SELECT b.user_id INTO _owner_id
    FROM public.buildings b
   WHERE b.id = NEW.building_id;

  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'building_not_found' USING ERRCODE = 'P0001';
  END IF;

  _allowance := public.user_unit_allowance(_owner_id);

  SELECT count(*) INTO _current
    FROM public.units u
    JOIN public.buildings b ON b.id = u.building_id
   WHERE b.user_id = _owner_id;

  IF _current + 1 > _allowance THEN
    RAISE EXCEPTION 'unit_quota_exceeded: allowance=% current=%', _allowance, _current
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Update user_active_plan to also recognise `amlaki_personal` (future-proof)
CREATE OR REPLACE FUNCTION public.user_active_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT CASE s.product_id
        WHEN 'amlaki_starter'    THEN 'personal'  -- renamed; legacy product_id retained in Paddle
        WHEN 'amlaki_personal'   THEN 'personal'
        WHEN 'amlaki_pro'        THEN 'pro'
        WHEN 'amlaki_business'   THEN 'business'
        WHEN 'amlaki_enterprise' THEN 'enterprise'
        ELSE 'free'
      END
      FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND s.environment = 'live'
        AND s.product_id NOT LIKE '%_addon'
        AND (
          (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
        )
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    'free'
  );
$function$;