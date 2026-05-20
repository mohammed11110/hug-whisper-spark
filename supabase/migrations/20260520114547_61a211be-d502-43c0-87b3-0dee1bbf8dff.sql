
-- Plan unit limit lookup
CREATE OR REPLACE FUNCTION public.get_plan_unit_limit(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'starter' THEN 25
    WHEN 'pro' THEN 75
    WHEN 'business' THEN 200
    WHEN 'enterprise' THEN 2147483647
    ELSE 5
  END;
$$;

-- Resolve a user's current active plan label (live env only)
CREATE OR REPLACE FUNCTION public.user_active_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE s.product_id
        WHEN 'amlaki_starter' THEN 'starter'
        WHEN 'amlaki_pro' THEN 'pro'
        WHEN 'amlaki_business' THEN 'business'
        WHEN 'amlaki_enterprise' THEN 'enterprise'
        ELSE 'free'
      END
      FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND s.environment = 'live'
        AND (
          (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
        )
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    'free'
  );
$$;

-- Trigger function: enforce plan unit quota on insert
CREATE OR REPLACE FUNCTION public.enforce_unit_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _plan text;
  _limit integer;
  _current integer;
BEGIN
  SELECT b.user_id INTO _owner_id
    FROM public.buildings b
   WHERE b.id = NEW.building_id;

  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'building_not_found' USING ERRCODE = 'P0001';
  END IF;

  _plan := public.user_active_plan(_owner_id);
  _limit := public.get_plan_unit_limit(_plan);

  SELECT count(*) INTO _current
    FROM public.units u
    JOIN public.buildings b ON b.id = u.building_id
   WHERE b.user_id = _owner_id;

  IF _current + 1 > _limit THEN
    RAISE EXCEPTION 'unit_quota_exceeded: plan=% limit=% current=%', _plan, _limit, _current
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_unit_quota_trigger ON public.units;
CREATE TRIGGER enforce_unit_quota_trigger
BEFORE INSERT ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.enforce_unit_quota();
