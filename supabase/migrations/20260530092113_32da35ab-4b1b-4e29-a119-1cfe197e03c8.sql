CREATE OR REPLACE FUNCTION public.end_trial_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p record;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;
  SELECT trial_ends_at, grace_ends_at INTO _p FROM public.profiles WHERE id = _uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'no_profile'); END IF;
  -- Only act if user is currently in trial
  IF _p.trial_ends_at IS NULL OR _p.trial_ends_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_trial');
  END IF;
  UPDATE public.profiles
     SET trial_ends_at = now(),
         grace_ends_at = COALESCE(grace_ends_at, now() + interval '30 days'),
         subscription_status = 'trial_ended',
         updated_at = now()
   WHERE id = _uid;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_trial_now() TO authenticated;