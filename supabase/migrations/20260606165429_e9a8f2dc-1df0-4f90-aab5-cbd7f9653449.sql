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

  INSERT INTO public.receipt_counters(user_id) VALUES (_uid)
    ON CONFLICT (user_id) DO NOTHING;

  -- Find the largest numeric suffix among existing receipt numbers for this
  -- user. Guard against values that don't fit in int4 (e.g. legacy receipt
  -- numbers that embed a millisecond timestamp) by filtering on length first
  -- and casting through numeric, then clamping to int4 max.
  SELECT COALESCE(MAX(n), 0)::int INTO _max
  FROM (
    SELECT LEAST(
             NULLIF(regexp_replace(split_part(p.receipt_number, '/', 1), '\D', '', 'g'), '')::numeric,
             2147483647::numeric
           )::int AS n
    FROM public.payments p
    WHERE p.user_id = _uid
      AND p.deleted_at IS NULL
      AND p.receipt_number IS NOT NULL
      AND length(regexp_replace(split_part(p.receipt_number, '/', 1), '\D', '', 'g')) BETWEEN 1 AND 9
  ) s;

  UPDATE public.receipt_counters
     SET next_number = GREATEST(next_number, _max + 1),
         updated_at  = now()
   WHERE user_id = _uid
   RETURNING * INTO _row;

  RETURN QUERY SELECT _row.prefix, _row.padding, _row.start_number, _row.next_number;
END;
$$;