CREATE OR REPLACE FUNCTION public.ensure_receipt_counter_seeded()
RETURNS TABLE(prefix text, padding integer, start_number integer, next_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _max int := 0;
  _row public.receipt_counters%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Ensure row exists
  INSERT INTO public.receipt_counters(user_id) VALUES (_uid)
    ON CONFLICT (user_id) DO NOTHING;

  -- Find the largest numeric suffix among existing receipt numbers for this user
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(split_part(p.receipt_number, '/', 1), '\D', '', 'g'), '')::int
  ), 0)
  INTO _max
  FROM public.payments p
  WHERE p.user_id = _uid
    AND p.deleted_at IS NULL
    AND p.receipt_number IS NOT NULL;

  -- Bump next_number to at least max+1
  UPDATE public.receipt_counters
     SET next_number = GREATEST(next_number, _max + 1),
         updated_at  = now()
   WHERE user_id = _uid
   RETURNING * INTO _row;

  RETURN QUERY SELECT _row.prefix, _row.padding, _row.start_number, _row.next_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_receipt_counter_seeded() TO authenticated;