-- Add Paddle fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_interval text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_paddle_customer ON public.profiles(paddle_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_paddle_subscription ON public.profiles(paddle_subscription_id);

-- Subscription events log
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  paddle_event_id text UNIQUE,
  paddle_subscription_id text,
  paddle_transaction_id text,
  amount numeric,
  currency text,
  invoice_url text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_user ON public.subscription_events(user_id, occurred_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription events"
ON public.subscription_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all subscription events"
ON public.subscription_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));