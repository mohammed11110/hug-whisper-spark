
-- Soft-delete / 30-day recovery for accounts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS purge_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_purge_at ON public.profiles(purge_at) WHERE purge_at IS NOT NULL;

-- Request soft deletion: marks the account as deactivated and schedules purge in 30 days.
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.profiles
     SET deactivated_at = COALESCE(deactivated_at, now()),
         purge_at       = COALESCE(purge_at, now() + interval '30 days'),
         subscription_status = 'deactivated',
         updated_at = now()
   WHERE id = _uid;

  RETURN jsonb_build_object(
    'success', true,
    'purge_at', (SELECT purge_at FROM public.profiles WHERE id = _uid)
  );
END;
$$;

-- Cancel deletion within the 30-day window
CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.profiles
     SET deactivated_at = NULL,
         purge_at       = NULL,
         subscription_status = CASE
           WHEN subscription_status = 'deactivated' THEN 'active'
           ELSE subscription_status END,
         updated_at = now()
   WHERE id = _uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;
