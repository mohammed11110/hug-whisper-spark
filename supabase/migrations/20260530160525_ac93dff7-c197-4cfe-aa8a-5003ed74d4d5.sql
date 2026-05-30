
-- 1) Index for lookups by tenancy
CREATE INDEX IF NOT EXISTS idx_payments_tenancy_id ON public.payments(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_unit_status ON public.tenancies(unit_id, status);

-- 2) Backfill payments.tenancy_id from payment_date ∈ [contract_start_date, ended_at|contract_end_date|+infinity]
UPDATE public.payments p
   SET tenancy_id = t.id
  FROM public.tenancies t
 WHERE p.tenancy_id IS NULL
   AND p.unit_id = t.unit_id
   AND p.deleted_at IS NULL
   AND (t.contract_start_date IS NULL OR p.payment_date >= t.contract_start_date)
   AND (
     COALESCE(t.ended_at, t.contract_end_date) IS NULL
     OR p.payment_date <= COALESCE(t.ended_at, t.contract_end_date)
   );

-- 3) Trigger: auto-fill tenancy_id on insert/update when caller leaves it null.
--    Prefers the active tenancy; otherwise falls back to a tenancy whose
--    period contains the payment_date.
CREATE OR REPLACE FUNCTION public.payments_autofill_tenancy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tid uuid;
BEGIN
  IF NEW.tenancy_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Prefer the unit's currently active tenancy
  SELECT id INTO _tid
    FROM public.tenancies
   WHERE unit_id = NEW.unit_id AND status = 'active'
   ORDER BY contract_start_date DESC NULLS LAST
   LIMIT 1;
  IF _tid IS NULL THEN
    -- Fallback: find a tenancy whose period contains the payment_date
    SELECT id INTO _tid
      FROM public.tenancies
     WHERE unit_id = NEW.unit_id
       AND (contract_start_date IS NULL OR NEW.payment_date >= contract_start_date)
       AND (
         COALESCE(ended_at, contract_end_date) IS NULL
         OR NEW.payment_date <= COALESCE(ended_at, contract_end_date)
       )
     ORDER BY contract_start_date DESC NULLS LAST
     LIMIT 1;
  END IF;
  IF _tid IS NOT NULL THEN
    NEW.tenancy_id := _tid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_autofill_tenancy ON public.payments;
CREATE TRIGGER trg_payments_autofill_tenancy
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payments_autofill_tenancy();

-- 4) Recompute unit state using the active tenancy_id (replaces date cutoff).
CREATE OR REPLACE FUNCTION public.recompute_unit_state(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  _active_tid uuid;
  _cutoff date;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT * INTO _u FROM public.units WHERE id = _uid;
  IF NOT FOUND THEN RETURN; END IF;

  -- Active tenancy for this unit (preferred filter for payments)
  SELECT id INTO _active_tid
    FROM public.tenancies
   WHERE unit_id = _uid AND status = 'active'
   ORDER BY contract_start_date DESC NULLS LAST
   LIMIT 1;

  -- Fallback date cutoff for legacy payments with NULL tenancy_id
  _cutoff := LEAST(
    COALESCE(_u.opening_balance_date, _u.contract_start_date),
    COALESCE(_u.contract_start_date, _u.opening_balance_date)
  );

  SELECT MAX(payment_date),
         COUNT(*) FILTER (WHERE kind = 'rent') > 0
    INTO _max, _has_payments
    FROM public.payments
   WHERE unit_id = _uid
     AND deleted_at IS NULL
     AND (
       (_active_tid IS NOT NULL AND tenancy_id = _active_tid)
       OR (_active_tid IS NULL AND tenancy_id IS NULL AND (_cutoff IS NULL OR COALESCE(period_start, payment_date) >= _cutoff))
       OR (tenancy_id IS NULL AND _cutoff IS NOT NULL AND COALESCE(period_start, payment_date) >= _cutoff)
     );

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
   WHERE unit_id = _uid
     AND deleted_at IS NULL
     AND kind = 'opening'
     AND (
       (_active_tid IS NOT NULL AND tenancy_id = _active_tid)
       OR (tenancy_id IS NULL AND (_cutoff IS NULL OR COALESCE(period_start, payment_date) >= _cutoff))
     );
  _total_due := _total_due + _opening_due;

  SELECT COALESCE(SUM(amount), 0) INTO _total_paid
    FROM public.payments
   WHERE unit_id = _uid
     AND deleted_at IS NULL
     AND kind = 'rent'
     AND (
       (_active_tid IS NOT NULL AND tenancy_id = _active_tid)
       OR (tenancy_id IS NULL AND (_cutoff IS NULL OR COALESCE(period_start, payment_date) >= _cutoff))
     );

  _balance := _total_due - _total_paid;

  IF _anchor IS NOT NULL THEN
    _next_due := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, _due_day);
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

  UPDATE public.units SET last_paid_date = _max, status = _new_status WHERE id = _uid;
END;
$$;

-- 5) Recompute all units once
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.units LOOP
    PERFORM public.recompute_unit_state(r.id);
  END LOOP;
END$$;
