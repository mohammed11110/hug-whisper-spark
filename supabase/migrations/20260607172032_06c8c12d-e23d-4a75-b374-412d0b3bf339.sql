
-- Update unit limits to new 5-tier model
CREATE OR REPLACE FUNCTION public.get_plan_unit_limit(_plan text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE _plan
    WHEN 'starter'    THEN 10
    WHEN 'personal'   THEN 10
    WHEN 'pro'        THEN 25
    WHEN 'business'   THEN 50
    WHEN 'enterprise' THEN 100
    ELSE 3
  END;
$function$;

-- Remove the addon-units fee; allowance is now just the plan limit
CREATE OR REPLACE FUNCTION public.user_unit_allowance(_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.get_plan_unit_limit(public.user_active_plan(_user_id));
$function$;

-- Add `frozen` phase. NEVER actually deletes data — frozen accounts keep
-- everything readable; renewing restores full access instantly.
CREATE OR REPLACE FUNCTION public.account_phase(_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub_phase text;
  _p record;
BEGIN
  IF _user_id IS NULL THEN RETURN 'free'; END IF;
  _sub_phase := public.subscription_phase(_user_id);
  IF _sub_phase IN ('active','canceled') THEN RETURN 'active'; END IF;
  IF _sub_phase = 'grace' THEN RETURN 'subscription_grace'; END IF;
  IF _sub_phase = 'deleted' THEN RETURN 'frozen'; END IF;

  SELECT trial_ends_at, grace_ends_at INTO _p FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN 'free'; END IF;

  IF _p.grace_ends_at IS NOT NULL AND _p.grace_ends_at <= now() THEN RETURN 'frozen'; END IF;
  IF _p.grace_ends_at IS NOT NULL AND _p.grace_ends_at > now() THEN RETURN 'readonly_grace'; END IF;
  IF _p.trial_ends_at IS NOT NULL AND _p.trial_ends_at > now() THEN RETURN 'trial'; END IF;
  IF _p.trial_ends_at IS NOT NULL AND _p.trial_ends_at <= now() THEN RETURN 'readonly_grace'; END IF;
  RETURN 'free';
END;
$function$;

-- Writes are blocked in any non-active, non-trial, non-free phase.
-- Free is allowed (within unit quota); readonly_grace, subscription_grace, frozen are blocked.
CREATE OR REPLACE FUNCTION public.can_write(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.account_phase(_user_id) IN ('trial','active','free');
$function$;

-- has_data_access is true whenever account is not deleted; frozen still allows reads.
CREATE OR REPLACE FUNCTION public.has_data_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.account_phase(_user_id) <> 'deleted';
$function$;
