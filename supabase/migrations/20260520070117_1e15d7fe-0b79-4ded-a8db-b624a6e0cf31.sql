-- Restrict SELECT on profiles to exclude the whatsapp_verification_code column.
-- This prevents users from reading their own OTP and bypassing WhatsApp delivery.

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
  subscription_expires_at,
  subscription_interval,
  trial_ends_at,
  canceled_at,
  created_at,
  updated_at,
  business_whatsapp,
  whatsapp_verified_at,
  whatsapp_code_expires_at,
  whatsapp_verification_attempts,
  paddle_customer_id,
  paddle_subscription_id
) ON public.profiles TO authenticated;

-- Preserve INSERT/UPDATE grants for the owner-scoped RLS policies
GRANT INSERT, UPDATE ON public.profiles TO authenticated;