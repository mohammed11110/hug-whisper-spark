
-- Add subscription expiry to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'pro',
  duration_days integer NOT NULL DEFAULT 30,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  redeemed_by uuid,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can attempt; the function does the work. No direct write.
CREATE POLICY "authenticated can read codes"
  ON public.promo_codes FOR SELECT
  TO authenticated
  USING (true);

-- Redemption function (SECURITY DEFINER bypasses RLS for the update)
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.promo_codes%ROWTYPE;
  _new_expiry timestamptz;
  _current_expiry timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _row FROM public.promo_codes
   WHERE upper(code) = upper(_code) FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF _row.used_count >= _row.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_expired');
  END IF;

  SELECT subscription_expires_at INTO _current_expiry FROM public.profiles WHERE id = _uid;
  _new_expiry := GREATEST(COALESCE(_current_expiry, now()), now()) + (_row.duration_days || ' days')::interval;

  UPDATE public.profiles
     SET subscription_plan = _row.plan,
         subscription_status = 'active',
         subscription_expires_at = _new_expiry,
         updated_at = now()
   WHERE id = _uid;

  UPDATE public.promo_codes
     SET used_count = used_count + 1,
         redeemed_by = _uid,
         redeemed_at = now()
   WHERE id = _row.id;

  RETURN jsonb_build_object(
    'success', true,
    'plan', _row.plan,
    'expires_at', _new_expiry
  );
END;
$$;

-- Seed 12 single-use 30-day codes
INSERT INTO public.promo_codes (code, plan, duration_days, max_uses) VALUES
  ('AMLAKI-FREE-001','pro',30,1),
  ('AMLAKI-FREE-002','pro',30,1),
  ('AMLAKI-FREE-003','pro',30,1),
  ('AMLAKI-FREE-004','pro',30,1),
  ('AMLAKI-FREE-005','pro',30,1),
  ('AMLAKI-FREE-006','pro',30,1),
  ('AMLAKI-FREE-007','pro',30,1),
  ('AMLAKI-FREE-008','pro',30,1),
  ('AMLAKI-FREE-009','pro',30,1),
  ('AMLAKI-FREE-010','pro',30,1),
  ('AMLAKI-FREE-011','pro',30,1),
  ('AMLAKI-FREE-012','pro',30,1)
ON CONFLICT (code) DO NOTHING;
