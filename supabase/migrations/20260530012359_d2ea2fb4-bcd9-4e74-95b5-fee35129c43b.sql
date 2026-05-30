
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'rent'
  CHECK (kind IN ('rent','opening','adjustment'));

CREATE INDEX IF NOT EXISTS idx_payments_unit_kind
  ON public.payments(unit_id, kind) WHERE deleted_at IS NULL;

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS grace_days int NOT NULL DEFAULT 0
  CHECK (grace_days BETWEEN 0 AND 30);

DROP FUNCTION IF EXISTS public.protect_unit_opening_balance() CASCADE;

INSERT INTO public.payments
  (unit_id, amount, payment_date, period_start, period_end,
   payment_method, notes, kind)
SELECT
  u.id,
  u.opening_balance,
  COALESCE(u.opening_balance_date, CURRENT_DATE),
  COALESCE(u.opening_balance_date, CURRENT_DATE),
  COALESCE(u.opening_balance_date, CURRENT_DATE),
  'opening',
  'OPENING_BALANCE_MIGRATION',
  'opening'
FROM public.units u
WHERE COALESCE(u.opening_balance, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.unit_id = u.id AND p.kind = 'opening'
  );

UPDATE public.units
   SET opening_balance = 0,
       opening_balance_date = NULL
 WHERE COALESCE(opening_balance, 0) <> 0
    OR opening_balance_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.recompute_unit_state(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _u record;
  _max date;
  _rent numeric;
  _anchor date;
  _due_day int;
  _timing text;
  _grace int;
  _elapsed int;
  _cycles_due int;
  _total_due numeric := 0;
  _total_paid numeric := 0;
  _opening_due numeric := 0;
  _balance numeric;
  _next_due date;
  _new_status text;
  _has_payments boolean;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT * INTO _u FROM public.units WHERE id = _uid;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT MAX(payment_date), COUNT(*) FILTER (WHERE kind = 'rent') > 0
    INTO _max, _has_payments
    FROM public.payments
   WHERE unit_id = _uid AND deleted_at IS NULL;

  _rent    := COALESCE(_u.rent_amount, 0);
  _anchor  := _u.contract_start_date;
  _due_day := LEAST(28, GREATEST(1, COALESCE(_u.due_day, 1)));
  _timing  := COALESCE(_u.rent_timing, 'advance');
  _grace   := COALESCE(_u.grace_days, 0);

  IF _anchor IS NOT NULL AND COALESCE(_u.rent_type, 'monthly') = 'monthly' AND _rent > 0 THEN
    _elapsed := GREATEST(0,
      (EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM _anchor)::int) * 12
      + (EXTRACT(MONTH FROM CURRENT_DATE)::int - EXTRACT(MONTH FROM _anchor)::int)
      - CASE WHEN EXTRACT(DAY FROM CURRENT_DATE)::int < EXTRACT(DAY FROM _anchor)::int THEN 1 ELSE 0 END
    );
    _cycles_due := CASE WHEN _timing = 'arrears' THEN _elapsed ELSE _elapsed + 1 END;
    _total_due  := _cycles_due * _rent;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _opening_due
    FROM public.payments
   WHERE unit_id = _uid AND deleted_at IS NULL AND kind = 'opening';
  _total_due := _total_due + _opening_due;

  SELECT COALESCE(SUM(amount), 0) INTO _total_paid
    FROM public.payments
   WHERE unit_id = _uid AND deleted_at IS NULL AND kind = 'rent';

  _balance := _total_due - _total_paid;

  IF _anchor IS NOT NULL THEN
    _next_due := make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      _due_day
    );
    IF _next_due < CURRENT_DATE THEN
      _next_due := (_next_due + interval '1 month')::date;
    END IF;
  END IF;

  IF _balance <= 0.009 THEN
    _new_status := CASE WHEN _has_payments THEN 'paid' ELSE 'soon' END;
  ELSIF _rent > 0 AND _balance >= 2 * _rent THEN
    _new_status := 'critical';
  ELSIF _next_due IS NOT NULL AND CURRENT_DATE < _next_due THEN
    _new_status := 'upcoming';
  ELSIF _next_due IS NOT NULL AND CURRENT_DATE <= _next_due + _grace THEN
    _new_status := CASE WHEN CURRENT_DATE = _next_due THEN 'due' ELSE 'grace' END;
  ELSE
    _new_status := 'late';
  END IF;

  UPDATE public.units
     SET last_paid_date = _max,
         status = _new_status
   WHERE id = _uid;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.units LOOP
    PERFORM public.recompute_unit_state(r.id);
  END LOOP;
END $$;
