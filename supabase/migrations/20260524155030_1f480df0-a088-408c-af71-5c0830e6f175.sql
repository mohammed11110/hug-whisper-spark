
CREATE OR REPLACE FUNCTION public.sync_unit_last_paid_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uids uuid[];
  _uid uuid;
  _max date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _uids := ARRAY[OLD.unit_id];
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.unit_id IS DISTINCT FROM NEW.unit_id THEN
      _uids := ARRAY[OLD.unit_id, NEW.unit_id];
    ELSE
      _uids := ARRAY[NEW.unit_id];
    END IF;
  ELSE
    _uids := ARRAY[NEW.unit_id];
  END IF;

  FOREACH _uid IN ARRAY _uids LOOP
    IF _uid IS NULL THEN CONTINUE; END IF;
    SELECT MAX(payment_date) INTO _max
      FROM public.payments
     WHERE unit_id = _uid AND deleted_at IS NULL;
    UPDATE public.units SET last_paid_date = _max WHERE id = _uid;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_unit_last_paid_date ON public.payments;
CREATE TRIGGER trg_sync_unit_last_paid_date
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.sync_unit_last_paid_date();

-- Backfill existing data
UPDATE public.units u
   SET last_paid_date = sub.max_date
  FROM (
    SELECT unit_id, MAX(payment_date) AS max_date
      FROM public.payments
     WHERE deleted_at IS NULL
     GROUP BY unit_id
  ) sub
 WHERE u.id = sub.unit_id
   AND (u.last_paid_date IS DISTINCT FROM sub.max_date);
