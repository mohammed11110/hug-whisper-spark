-- 1) Add explicit ELSE FALSE in has_building_access to remove latent NULL hazard
CREATE OR REPLACE FUNCTION public.has_building_access(_building_id uuid, _user_id uuid, _min_role member_role DEFAULT 'viewer'::member_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_building_owner(_building_id, _user_id)
    OR EXISTS (
      SELECT 1 FROM public.building_members m
      WHERE m.building_id = _building_id AND m.user_id = _user_id
        AND CASE _min_role
          WHEN 'viewer' THEN TRUE
          WHEN 'accountant' THEN m.role IN ('manager','accountant')
          WHEN 'manager' THEN m.role = 'manager'
          ELSE FALSE
        END
    );
$function$;

-- 2) Hide sensitive WhatsApp verification columns from authenticated SELECT
--    by switching profiles to column-level grants. service_role keeps full access.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, name, email, phone, country_code,
  subscription_plan, subscription_status, canceled_at, created_at, updated_at,
  subscription_expires_at, paddle_customer_id, paddle_subscription_id,
  subscription_interval, trial_ends_at, trial_started_at, grace_ends_at,
  business_whatsapp, whatsapp_verified_at
) ON public.profiles TO authenticated;