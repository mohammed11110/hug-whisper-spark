
-- 1. Add lifecycle columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_delete_at timestamptz,
  ADD COLUMN IF NOT EXISTS reactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_kind text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_data_delete_at
  ON public.subscriptions(data_delete_at)
  WHERE data_delete_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period_end
  ON public.subscriptions(status, current_period_end);

-- 2. subscription_phase helper
CREATE OR REPLACE FUNCTION public.subscription_phase(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
BEGIN
  IF _user_id IS NULL THEN RETURN 'free'; END IF;

  SELECT status, current_period_end, data_delete_at, canceled_at
    INTO _row
    FROM public.subscriptions
   WHERE user_id = _user_id
     AND environment = 'live'
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN RETURN 'free'; END IF;

  -- Permanently deleted
  IF _row.status = 'deleted' THEN RETURN 'deleted'; END IF;

  -- Grace window: subscription ended, kept for 30 days
  IF _row.data_delete_at IS NOT NULL AND _row.data_delete_at > now() THEN
    RETURN 'grace';
  END IF;

  -- Past data_delete_at without lifecycle promotion yet
  IF _row.data_delete_at IS NOT NULL AND _row.data_delete_at <= now() THEN
    RETURN 'deleted';
  END IF;

  -- Active, trialing, past_due: full access
  IF _row.status IN ('active','trialing','past_due')
     AND (_row.current_period_end IS NULL OR _row.current_period_end > now()) THEN
    RETURN 'active';
  END IF;

  -- Canceled but still inside paid period
  IF _row.status = 'canceled'
     AND _row.current_period_end IS NOT NULL
     AND _row.current_period_end > now() THEN
    RETURN 'canceled';
  END IF;

  -- Canceled and past period end, but no data_delete_at set yet -> treat as grace
  IF _row.status = 'canceled' AND _row.current_period_end IS NOT NULL
     AND _row.current_period_end <= now()
     AND (_row.current_period_end + interval '30 days') > now() THEN
    RETURN 'grace';
  END IF;

  RETURN 'free';
END;
$$;

-- 3. has_data_access helper (true during active, canceled, grace — used for reads/exports)
CREATE OR REPLACE FUNCTION public.has_data_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.subscription_phase(_user_id) IN ('active','canceled','grace','free');
$$;

-- 4. can_write helper (false during grace / deleted)
CREATE OR REPLACE FUNCTION public.can_write(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.subscription_phase(_user_id) IN ('active','canceled','free');
$$;

-- 5. Reactivate helper (called by client after Paddle resume; webhook also updates)
CREATE OR REPLACE FUNCTION public.reactivate_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.subscriptions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _row FROM public.subscriptions
   WHERE user_id = _uid AND environment = 'live'
   ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_subscription');
  END IF;

  IF _row.status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_deleted');
  END IF;

  UPDATE public.subscriptions
     SET status = 'active',
         canceled_at = NULL,
         grace_started_at = NULL,
         data_delete_at = NULL,
         reactivated_at = now(),
         cancel_at_period_end = false,
         updated_at = now()
   WHERE id = _row.id;

  UPDATE public.profiles
     SET subscription_status = 'active',
         canceled_at = NULL,
         updated_at = now()
   WHERE id = _uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscription_phase(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_data_access(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription() TO authenticated, service_role;

-- 6. RESTRICTIVE write-gating policies on user-owned tables.
-- These are ADDITIVE to existing permissive policies and block writes during grace/deleted.
-- Service role bypasses RLS entirely so webhooks + lifecycle job are unaffected.

-- buildings
DROP POLICY IF EXISTS "Block writes in grace" ON public.buildings;
CREATE POLICY "Block writes in grace"
  ON public.buildings AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    -- SELECT always allowed; only blocks I/U/D when user is in grace/deleted
    (current_setting('request.method', true) IS NULL)
    OR public.can_write(auth.uid())
  )
  WITH CHECK (public.can_write(auth.uid()));

-- units
DROP POLICY IF EXISTS "Block writes in grace" ON public.units;
CREATE POLICY "Block writes in grace"
  ON public.units AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.method', true) IS NULL)
    OR public.can_write((SELECT user_id FROM public.buildings WHERE id = units.building_id))
  )
  WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = units.building_id)));

-- payments
DROP POLICY IF EXISTS "Block writes in grace" ON public.payments;
CREATE POLICY "Block writes in grace"
  ON public.payments AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.method', true) IS NULL)
    OR public.can_write((SELECT b.user_id FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE u.id = payments.unit_id))
  )
  WITH CHECK (public.can_write((SELECT b.user_id FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE u.id = payments.unit_id)));

-- expenses
DROP POLICY IF EXISTS "Block writes in grace" ON public.expenses;
CREATE POLICY "Block writes in grace"
  ON public.expenses AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.method', true) IS NULL)
    OR public.can_write((SELECT user_id FROM public.buildings WHERE id = expenses.building_id))
  )
  WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = expenses.building_id)));

-- tenancies
DROP POLICY IF EXISTS "Block writes in grace" ON public.tenancies;
CREATE POLICY "Block writes in grace"
  ON public.tenancies AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.method', true) IS NULL)
    OR public.can_write((SELECT user_id FROM public.buildings WHERE id = tenancies.building_id))
  )
  WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = tenancies.building_id)));

-- maintenance_requests
DROP POLICY IF EXISTS "Block writes in grace" ON public.maintenance_requests;
CREATE POLICY "Block writes in grace"
  ON public.maintenance_requests AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.method', true) IS NULL)
    OR public.can_write((SELECT user_id FROM public.buildings WHERE id = maintenance_requests.building_id))
  )
  WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = maintenance_requests.building_id)));

-- daily_bookings
DROP POLICY IF EXISTS "Block writes in grace" ON public.daily_bookings;
CREATE POLICY "Block writes in grace"
  ON public.daily_bookings AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.method', true) IS NULL)
    OR public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_bookings.building_id))
  )
  WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_bookings.building_id)));

-- daily_units
DROP POLICY IF EXISTS "Block writes in grace" ON public.daily_units;
CREATE POLICY "Block writes in grace"
  ON public.daily_units AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.method', true) IS NULL)
    OR public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_units.building_id))
  )
  WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_units.building_id)));
