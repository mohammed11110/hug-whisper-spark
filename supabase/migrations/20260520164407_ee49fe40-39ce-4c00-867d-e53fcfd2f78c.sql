-- Prevent self-elevation: lock system-managed columns on profiles UPDATE
-- Users can update their profile but cannot change subscription, paddle, or
-- whatsapp-verification fields. Service role (webhooks, edge functions) bypasses.
CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (webhooks / admin edge functions) full control
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Force system-managed columns back to their OLD values
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
$$;

DROP TRIGGER IF EXISTS protect_profile_system_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_system_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_system_fields();

-- Also tighten the UPDATE policy with WITH CHECK so future changes also enforce ownership
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);