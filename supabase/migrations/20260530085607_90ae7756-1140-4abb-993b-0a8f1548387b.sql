CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- channel toggles (master switches)
  channel_email BOOLEAN NOT NULL DEFAULT true,
  channel_in_app BOOLEAN NOT NULL DEFAULT true,
  channel_push BOOLEAN NOT NULL DEFAULT true,
  -- per-event toggles
  event_rent_due_soon BOOLEAN NOT NULL DEFAULT true,
  event_rent_overdue BOOLEAN NOT NULL DEFAULT true,
  event_contract_expiring BOOLEAN NOT NULL DEFAULT true,
  event_payment_received BOOLEAN NOT NULL DEFAULT true,
  event_trial_ending BOOLEAN NOT NULL DEFAULT true,
  event_deletion_warning BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notif prefs"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notif prefs"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notif prefs"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notif prefs"
  ON public.notification_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ensure each user has a row on first request via a unique upsert pattern client-side.
-- We also add an idempotent unique index on (user_id, token) for push_subscriptions
-- so the upsert in src/lib/push.ts can use onConflict='user_id,token'.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_token_idx
  ON public.push_subscriptions (user_id, token);