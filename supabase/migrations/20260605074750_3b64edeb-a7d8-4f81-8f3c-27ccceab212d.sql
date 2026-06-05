
-- Restrict column-level SELECT on public.profiles so sensitive
-- billing identifiers and WhatsApp verification secrets are not
-- exposed to authenticated clients via the Data API / RLS.
--
-- Strategy: revoke the broad table-level SELECT and re-grant
-- SELECT only on the safe (client-facing) columns. RLS policies
-- continue to scope rows; column grants additionally scope fields.

REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT (
  id,
  name,
  email,
  phone,
  country_code,
  subscription_plan,
  subscription_status,
  canceled_at,
  created_at,
  updated_at,
  subscription_expires_at,
  subscription_interval,
  trial_ends_at,
  business_whatsapp,
  whatsapp_verified_at,
  trial_started_at,
  grace_ends_at
) ON public.profiles TO authenticated;

-- service_role keeps full access for edge functions / webhooks
GRANT ALL ON public.profiles TO service_role;
