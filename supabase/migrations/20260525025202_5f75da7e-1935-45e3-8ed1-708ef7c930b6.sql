-- 1) Drop old trigger + function (was only syncing last_paid_date)
DROP TRIGGER IF EXISTS sync_unit_last_paid_date_trg ON public.payments;
DROP TRIGGER IF EXISTS payments_sync_unit_last_paid_date ON public.payments;
DROP FUNCTION IF EXISTS public.sync_unit_last_paid_date() CASCADE;

-- 2) Helper: recompute a single unit's last_paid_date + status
CREATE OR REPLACE FUNCTION public.recompute_unit_state(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Prior arrears: opening_balance minus payments tagged as prior-arrears
  -- (period_start = period_end = anchor).
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

  -- Monthly cycle shortfalls since anchor
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

      SELECT COALESCE(SUM(amount), 0) INTO _cycle_paid
        FROM public.payments
       WHERE unit_id = _uid AND deleted_at IS NULL
         AND period_start IS NOT NULL
         AND NOT (period_end IS NOT NULL AND period_start = period_end)
         AND period_start >= _cycle_start
         AND period_start <= _cycle_end;

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
$$;

-- 3) Trigger function: dispatch to recompute for affected unit(s)
CREATE OR REPLACE FUNCTION public.sync_unit_state_from_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_unit_state(OLD.unit_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.unit_id IS DISTINCT FROM NEW.unit_id THEN
      PERFORM public.recompute_unit_state(OLD.unit_id);
    END IF;
    PERFORM public.recompute_unit_state(NEW.unit_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_unit_state(NEW.unit_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER sync_unit_state_from_payments_trg
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.sync_unit_state_from_payments();

-- 4) Backfill: recompute all units once with the new logic
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.units LOOP
    PERFORM public.recompute_unit_state(r.id);
  END LOOP;
END $$;