
-- 1) Allow SECURITY DEFINER functions (running as postgres) to update profile system fields.
-- This fixes redeem_promo_code: previously the trigger reverted subscription_plan changes
-- because auth.role() is 'authenticated' inside SECURITY DEFINER calls from users.
CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role (webhooks) and postgres (SECURITY DEFINER funcs like redeem_promo_code)
  IF auth.role() = 'service_role' OR current_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  NEW.subscription_plan          := OLD.subscription_plan;
  NEW.subscription_status        := OLD.subscription_status;
  NEW.subscription_expires_at    := OLD.subscription_expires_at;
  NEW.subscription_interval      := OLD.subscription_interval;
  NEW.trial_ends_at              := OLD.trial_ends_at;
  NEW.canceled_at                := OLD.canceled_at;
  NEW.paddle_subscription_id     := OLD.paddle_subscription_id;
  NEW.paddle_customer_id         := OLD.paddle_customer_id;
  NEW.whatsapp_verified_at       := OLD.whatsapp_verified_at;
  NEW.whatsapp_verification_code := OLD.whatsapp_verification_code;
  NEW.whatsapp_code_expires_at   := OLD.whatsapp_code_expires_at;
  NEW.whatsapp_verification_attempts := OLD.whatsapp_verification_attempts;

  RETURN NEW;
END;
$function$;

-- 2) Harden SECURITY DEFINER helper functions: revoke from anon, keep authenticated only
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_invitations_for_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_invitations_for_user() TO service_role;

-- 3) Cleanup old canceled promo subscriptions (keep only most recent per user)
DELETE FROM public.subscriptions s
WHERE s.paddle_subscription_id LIKE 'promo_%'
  AND s.status = 'canceled'
  AND s.id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM public.subscriptions
    WHERE paddle_subscription_id LIKE 'promo_%'
    ORDER BY user_id, created_at DESC
  );

-- 4) Re-sync profiles.subscription_plan from active subscriptions (after trigger fix)
UPDATE public.profiles p
SET subscription_plan = public.user_active_plan(p.id),
    updated_at = now()
WHERE p.subscription_plan IS DISTINCT FROM public.user_active_plan(p.id);
