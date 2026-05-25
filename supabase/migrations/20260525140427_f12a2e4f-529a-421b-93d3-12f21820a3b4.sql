CREATE OR REPLACE FUNCTION public.protect_unit_opening_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _has_payments boolean;
  _tenancy_changed boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(NEW.opening_balance,0) <> COALESCE(OLD.opening_balance,0))
     OR (NEW.opening_balance_date IS DISTINCT FROM OLD.opening_balance_date) THEN

    _tenancy_changed :=
      (NEW.tenant_name IS DISTINCT FROM OLD.tenant_name)
      OR (NEW.contract_start_date IS DISTINCT FROM OLD.contract_start_date)
      OR (NEW.contract_end_date IS DISTINCT FROM OLD.contract_end_date);

    IF NOT _tenancy_changed THEN
      SELECT EXISTS (
        SELECT 1 FROM public.payments
        WHERE unit_id = NEW.id AND deleted_at IS NULL
      ) INTO _has_payments;
      IF _has_payments THEN
        RAISE EXCEPTION 'opening_balance_locked: cannot edit opening balance directly after payments exist; record a payment instead'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;