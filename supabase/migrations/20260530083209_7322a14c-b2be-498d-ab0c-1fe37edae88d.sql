-- Trial + grace + notifications

-- 1. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz;

-- Backfill existing users
UPDATE public.profiles
   SET trial_started_at = COALESCE(trial_started_at, created_at),
       trial_ends_at    = COALESCE(trial_ends_at,    created_at + interval '14 days')
 WHERE trial_ends_at IS NULL;

-- 2. handle_new_user: set trial window on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, trial_started_at, trial_ends_at, subscription_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.phone,
    now(),
    now() + interval '14 days',
    'trial'
  );
  RETURN NEW;
END;
$$;

-- 3. account_phase: trial + paid sub unified
CREATE OR REPLACE FUNCTION public.account_phase(_user_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _sub_phase text;
  _p record;
BEGIN
  IF _user_id IS NULL THEN RETURN 'free'; END IF;
  _sub_phase := public.subscription_phase(_user_id);
  -- Paid sub always wins
  IF _sub_phase IN ('active','canceled') THEN RETURN 'active'; END IF;
  IF _sub_phase = 'grace' THEN RETURN 'subscription_grace'; END IF;
  IF _sub_phase = 'deleted' THEN RETURN 'deleted'; END IF;

  SELECT trial_ends_at, grace_ends_at INTO _p FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN 'free'; END IF;

  IF _p.grace_ends_at IS NOT NULL AND _p.grace_ends_at <= now() THEN RETURN 'deleted'; END IF;
  IF _p.grace_ends_at IS NOT NULL AND _p.grace_ends_at > now() THEN RETURN 'readonly_grace'; END IF;
  IF _p.trial_ends_at IS NOT NULL AND _p.trial_ends_at > now() THEN RETURN 'trial'; END IF;
  IF _p.trial_ends_at IS NOT NULL AND _p.trial_ends_at <= now() THEN RETURN 'readonly_grace'; END IF;
  RETURN 'free';
END;
$$;

-- 4. can_write / has_data_access updated to use account_phase
CREATE OR REPLACE FUNCTION public.can_write(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.account_phase(_user_id) IN ('trial','active','free'); $$;

CREATE OR REPLACE FUNCTION public.has_data_access(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.account_phase(_user_id) <> 'deleted'; $$;

-- 5. Unlimited units during trial: bypass quota
CREATE OR REPLACE FUNCTION public.enforce_unit_quota()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _owner_id uuid;
  _phase text;
  _allowance integer;
  _current integer;
BEGIN
  SELECT b.user_id INTO _owner_id FROM public.buildings b WHERE b.id = NEW.building_id;
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'building_not_found' USING ERRCODE = 'P0001';
  END IF;
  _phase := public.account_phase(_owner_id);
  -- Trial users: unlimited
  IF _phase = 'trial' THEN RETURN NEW; END IF;

  _allowance := public.user_unit_allowance(_owner_id);
  SELECT count(*) INTO _current
    FROM public.units u JOIN public.buildings b ON b.id = u.building_id
   WHERE b.user_id = _owner_id;
  IF _current + 1 > _allowance THEN
    RAISE EXCEPTION 'unit_quota_exceeded: allowance=% current=%', _allowance, _current
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- 6. notification_log
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  channel text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, channel)
);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notif log" ON public.notification_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service manages notif log" ON public.notification_log FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

-- 7. in_app_notifications
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title_ar text NOT NULL,
  title_en text,
  body_ar text NOT NULL,
  body_en text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_in_app_notif_user_created ON public.in_app_notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own in_app" ON public.in_app_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users mark read own in_app" ON public.in_app_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service inserts in_app" ON public.in_app_notifications FOR INSERT WITH CHECK (auth.role()='service_role');

-- 8. push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios','android','web')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;

-- 10. Reactivate now also clears profile grace_ends_at
CREATE OR REPLACE FUNCTION public.reactivate_subscription()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.subscriptions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;
  SELECT * INTO _row FROM public.subscriptions WHERE user_id = _uid AND environment = 'live'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND _row.status <> 'deleted' THEN
    UPDATE public.subscriptions
       SET status='active', canceled_at=NULL, grace_started_at=NULL, data_delete_at=NULL,
           reactivated_at=now(), cancel_at_period_end=false, updated_at=now()
     WHERE id = _row.id;
  END IF;
  UPDATE public.profiles
     SET subscription_status='active', canceled_at=NULL, grace_ends_at=NULL, updated_at=now()
   WHERE id = _uid;
  RETURN jsonb_build_object('success', true);
END;
$$;