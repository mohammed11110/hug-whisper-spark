
-- 1) activity_log: drop client INSERT policy, add SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Users insert own activity" ON public.activity_log;

CREATE OR REPLACE FUNCTION public.log_activity(
  _action text,
  _entity_type text,
  _entity_id uuid DEFAULT NULL,
  _building_id uuid DEFAULT NULL,
  _description_ar text DEFAULT NULL,
  _description_en text DEFAULT NULL,
  _changes jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF _building_id IS NOT NULL
     AND NOT public.has_building_access(_building_id, _uid, 'viewer'::member_role) THEN
    RAISE EXCEPTION 'no_building_access' USING ERRCODE = '42501';
  END IF;

  -- Enforce safe length limits so users can't dump large blobs into the log.
  IF length(coalesce(_action, '')) > 64
     OR length(coalesce(_entity_type, '')) > 64
     OR length(coalesce(_description_ar, '')) > 1000
     OR length(coalesce(_description_en, '')) > 1000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.activity_log (
    user_id, building_id, action, entity_type, entity_id,
    description_ar, description_en, changes
  ) VALUES (
    _uid, _building_id, _action, _entity_type, _entity_id,
    _description_ar, _description_en, _changes
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity(text, text, uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, uuid, text, text, jsonb) TO authenticated;

-- 2) unit_audit_log: restrict INSERT to service_role role binding
DROP POLICY IF EXISTS "Service role inserts unit_audit_log" ON public.unit_audit_log;

CREATE POLICY "Service role inserts unit_audit_log"
  ON public.unit_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Belt-and-suspenders: restrictive policy that blocks any non-service-role insert,
-- even if a future permissive policy is accidentally added.
CREATE POLICY "Block non-service-role inserts on unit_audit_log"
  ON public.unit_audit_log
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- 3) profiles: hide sensitive columns from client reads
-- The existing 'Users view own profile' policy still allows the row to be
-- selected, but column-level privileges prevent these fields from being
-- returned via the Data API. Edge functions use service_role and are unaffected.
REVOKE SELECT (
  whatsapp_verification_code,
  whatsapp_code_expires_at,
  whatsapp_verification_attempts,
  paddle_customer_id,
  paddle_subscription_id
) ON public.profiles FROM authenticated, anon;
