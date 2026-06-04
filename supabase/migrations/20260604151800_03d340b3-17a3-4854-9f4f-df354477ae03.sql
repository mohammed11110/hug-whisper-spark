
CREATE OR REPLACE FUNCTION public.log_activity(
  _action text,
  _entity_type text,
  _entity_id uuid DEFAULT NULL,
  _building_id uuid DEFAULT NULL,
  _description_ar text DEFAULT NULL,
  _description_en text DEFAULT NULL,
  _changes jsonb DEFAULT NULL,
  _entity_label text DEFAULT NULL
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

  IF length(coalesce(_action, '')) > 64
     OR length(coalesce(_entity_type, '')) > 64
     OR length(coalesce(_entity_label, '')) > 256
     OR length(coalesce(_description_ar, '')) > 1000
     OR length(coalesce(_description_en, '')) > 1000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.activity_log (
    user_id, building_id, action, entity_type, entity_id, entity_label,
    description_ar, description_en, changes
  ) VALUES (
    _uid, _building_id, _action, _entity_type, _entity_id, _entity_label,
    _description_ar, _description_en, _changes
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- Drop the previous overload (different signature) so PostgREST picks the new one cleanly.
DROP FUNCTION IF EXISTS public.log_activity(text, text, uuid, uuid, text, text, jsonb);

REVOKE ALL ON FUNCTION public.log_activity(text, text, uuid, uuid, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, uuid, text, text, jsonb, text) TO authenticated;
