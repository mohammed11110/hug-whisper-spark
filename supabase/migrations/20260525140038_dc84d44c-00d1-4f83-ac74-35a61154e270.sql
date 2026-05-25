-- 1) Audit log table
CREATE TABLE IF NOT EXISTS public.unit_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid,
  unit_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_audit_unit ON public.unit_audit_log(unit_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_unit_audit_building ON public.unit_audit_log(building_id, changed_at DESC);

ALTER TABLE public.unit_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read unit_audit_log"
ON public.unit_audit_log FOR SELECT
USING (building_id IS NULL OR public.has_building_access(building_id, auth.uid(), 'viewer'::member_role));

-- Inserts only from triggers (service role / definer)
CREATE POLICY "Service role inserts unit_audit_log"
ON public.unit_audit_log FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 2) Protect opening_balance / opening_balance_date on units after payments exist
CREATE OR REPLACE FUNCTION public.protect_unit_opening_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _has_payments boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(NEW.opening_balance,0) <> COALESCE(OLD.opening_balance,0))
     OR (NEW.opening_balance_date IS DISTINCT FROM OLD.opening_balance_date) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.payments
      WHERE unit_id = NEW.id AND deleted_at IS NULL
    ) INTO _has_payments;
    IF _has_payments THEN
      RAISE EXCEPTION 'opening_balance_locked: cannot change opening balance after payments exist on this unit'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_unit_opening_balance ON public.units;
CREATE TRIGGER trg_protect_unit_opening_balance
BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_opening_balance();

-- 3) Audit triggers for units (rent_amount, opening_balance, opening_balance_date, due_day, rent_timing, contract dates, tenant info)
CREATE OR REPLACE FUNCTION public.audit_unit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _fields text[] := ARRAY['rent_amount','opening_balance','opening_balance_date','due_day','rent_timing','contract_start_date','contract_end_date','tenant_name','tenant_phone','security_deposit','status'];
  _f text;
  _old text;
  _new text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.unit_audit_log(building_id, unit_id, entity_type, entity_id, action, changed_by)
    VALUES (NEW.building_id, NEW.id, 'unit', NEW.id, 'create', _uid);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.unit_audit_log(building_id, unit_id, entity_type, entity_id, action, changed_by)
    VALUES (OLD.building_id, OLD.id, 'unit', OLD.id, 'delete', _uid);
    RETURN OLD;
  ELSE
    FOREACH _f IN ARRAY _fields LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', _f, _f) INTO _old, _new USING OLD, NEW;
      IF _old IS DISTINCT FROM _new THEN
        INSERT INTO public.unit_audit_log(building_id, unit_id, entity_type, entity_id, action, field_name, old_value, new_value, changed_by)
        VALUES (NEW.building_id, NEW.id, 'unit', NEW.id, 'update', _f, _old, _new, _uid);
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_units ON public.units;
CREATE TRIGGER trg_audit_units
AFTER INSERT OR UPDATE OR DELETE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.audit_unit_changes();

-- 4) Audit triggers for payments
CREATE OR REPLACE FUNCTION public.audit_payment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT building_id INTO _bid FROM public.units WHERE id = NEW.unit_id;
    INSERT INTO public.unit_audit_log(building_id, unit_id, entity_type, entity_id, action, new_value, changed_by)
    VALUES (_bid, NEW.unit_id, 'payment', NEW.id, 'create', NEW.amount::text, _uid);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT building_id INTO _bid FROM public.units WHERE id = OLD.unit_id;
    INSERT INTO public.unit_audit_log(building_id, unit_id, entity_type, entity_id, action, old_value, changed_by)
    VALUES (_bid, OLD.unit_id, 'payment', OLD.id, 'delete', OLD.amount::text, _uid);
    RETURN OLD;
  ELSE
    SELECT building_id INTO _bid FROM public.units WHERE id = NEW.unit_id;
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      INSERT INTO public.unit_audit_log(building_id, unit_id, entity_type, entity_id, action, field_name, old_value, new_value, changed_by)
      VALUES (_bid, NEW.unit_id, 'payment', NEW.id, 'update', 'amount', OLD.amount::text, NEW.amount::text, _uid);
    END IF;
    IF OLD.payment_date IS DISTINCT FROM NEW.payment_date THEN
      INSERT INTO public.unit_audit_log(building_id, unit_id, entity_type, entity_id, action, field_name, old_value, new_value, changed_by)
      VALUES (_bid, NEW.unit_id, 'payment', NEW.id, 'update', 'payment_date', OLD.payment_date::text, NEW.payment_date::text, _uid);
    END IF;
    IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.unit_audit_log(building_id, unit_id, entity_type, entity_id, action, changed_by)
      VALUES (_bid, NEW.unit_id, 'payment', NEW.id, 'soft_delete', _uid);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.audit_payment_changes();