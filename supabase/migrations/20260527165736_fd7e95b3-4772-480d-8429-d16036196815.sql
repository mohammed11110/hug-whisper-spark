CREATE OR REPLACE FUNCTION public.recompute_unit_state(_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _u record;
  _max date;
  _opening numeric;
  _rent numeric;
  _anchor date;
  _due_day int;
  _timing text;
  _elapsed int;
  _cycles_due int;
  _i int;
  _cycle_start date;
  _cycle_end date;
  _cycle_paid numeric;
  _prior_paid numeric;
  _arrears boolean := false;
  _has_payments boolean := false;
  _new_status text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT * INTO _u FROM public.units WHERE id = _uid;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT MAX(payment_date), COUNT(*) > 0
    INTO _max, _has_payments
    FROM public.payments
   WHERE unit_id = _uid AND deleted_at IS NULL;

  _opening := COALESCE(_u.opening_balance, 0);
  _rent    := COALESCE(_u.rent_amount, 0);
  _anchor  := COALESCE(_u.opening_balance_date, _u.contract_start_date);
  _due_day := LEAST(28, GREATEST(1, COALESCE(_u.due_day, 1)));
  _timing  := COALESCE(_u.rent_timing, 'advance');

  IF _opening > 0 AND _anchor IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO _prior_paid
      FROM public.payments
     WHERE unit_id = _uid AND deleted_at IS NULL
       AND period_start IS NOT NULL AND period_end IS NOT NULL
       AND period_start = period_end
       AND period_start = _anchor;
    IF _opening - COALESCE(_prior_paid, 0) > 0.009 THEN
      _arrears := true;
    END IF;
  END IF;

  IF NOT _arrears AND _anchor IS NOT NULL AND _rent > 0
     AND COALESCE(_u.rent_type, 'monthly') = 'monthly' THEN
    _elapsed := GREATEST(0,
      (EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM _anchor)::int) * 12
      + (EXTRACT(MONTH FROM CURRENT_DATE)::int - EXTRACT(MONTH FROM _anchor)::int)
      - CASE WHEN EXTRACT(DAY FROM CURRENT_DATE)::int < EXTRACT(DAY FROM _anchor)::int THEN 1 ELSE 0 END
    );
    _cycles_due := CASE WHEN _timing = 'arrears' THEN _elapsed ELSE _elapsed + 1 END;

    FOR _i IN 0 .. _cycles_due - 1 LOOP
      _cycle_start := make_date(
        EXTRACT(YEAR  FROM _anchor)::int + ((EXTRACT(MONTH FROM _anchor)::int - 1 + _i) / 12),
        ((EXTRACT(MONTH FROM _anchor)::int - 1 + _i) % 12) + 1,
        _due_day
      );
      IF _due_day = 1 THEN
        _cycle_end := (date_trunc('month', _cycle_start) + interval '1 month - 1 day')::date;
      ELSE
        _cycle_end := (_cycle_start + interval '1 month - 1 day')::date;
      END IF;

      -- Match by OVERLAP rather than start-within-cycle.
      SELECT COALESCE(SUM(amount), 0) INTO _cycle_paid
        FROM public.payments
       WHERE unit_id = _uid AND deleted_at IS NULL
         AND period_start IS NOT NULL
         AND NOT (period_end IS NOT NULL AND period_start = period_end)
         AND period_start <= _cycle_end
         AND COALESCE(period_end, period_start) >= _cycle_start;

      IF COALESCE(_cycle_paid, 0) + 0.009 < _rent THEN
        _arrears := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF _arrears THEN
    _new_status := 'late';
  ELSIF NOT _has_payments THEN
    _new_status := 'soon';
  ELSE
    _new_status := 'paid';
  END IF;

  UPDATE public.units
     SET last_paid_date = _max,
         status = _new_status
   WHERE id = _uid;
END;
$function$;