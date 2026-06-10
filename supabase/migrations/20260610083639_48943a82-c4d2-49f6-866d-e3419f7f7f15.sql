
-- 1. email_unsubscribe_tokens: add RESTRICTIVE policy blocking non-service-role SELECT
CREATE POLICY "Block client SELECT on unsubscribe tokens"
  ON public.email_unsubscribe_tokens
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (false);

-- 2. suppressed_emails: add RESTRICTIVE policy blocking non-service-role SELECT
CREATE POLICY "Block client SELECT on suppressed emails"
  ON public.suppressed_emails
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (false);

-- 3. subscription_events: remove client SELECT access entirely (client never reads this table; payload contains raw Paddle webhook data)
DROP POLICY IF EXISTS "Users view own subscription events" ON public.subscription_events;

-- 4. subscriptions: restrict the paddle_customer_id column from authenticated reads.
-- paddle_subscription_id remains client-readable since the UI uses it to detect promo subs
-- and the customer portal flow. paddle_customer_id is never used client-side.
REVOKE SELECT (paddle_customer_id) ON public.subscriptions FROM authenticated, anon;
