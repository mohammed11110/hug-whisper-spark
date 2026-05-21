-- Link maintenance requests to expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS maintenance_request_id uuid UNIQUE;

CREATE OR REPLACE FUNCTION public.sync_maintenance_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _desc text;
  _date date;
BEGIN
  -- DELETE: remove linked expense
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.expenses WHERE maintenance_request_id = OLD.id;
    RETURN OLD;
  END IF;

  _desc := COALESCE(NEW.title, 'Maintenance');
  IF NEW.vendor IS NOT NULL AND length(trim(NEW.vendor)) > 0 THEN
    _desc := _desc || ' — ' || NEW.vendor;
  END IF;
  _date := COALESCE(NEW.resolved_at::date, CURRENT_DATE);

  -- Status transitioned OUT of done -> remove linked expense
  IF TG_OP = 'UPDATE' AND OLD.status = 'done' AND NEW.status <> 'done' THEN
    DELETE FROM public.expenses WHERE maintenance_request_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Status is done with positive cost -> upsert expense
  IF NEW.status = 'done' AND NEW.cost IS NOT NULL AND NEW.cost > 0 THEN
    INSERT INTO public.expenses (
      building_id, unit_id, category, amount, vendor, description, expense_date, maintenance_request_id
    ) VALUES (
      NEW.building_id, NEW.unit_id, 'maintenance', NEW.cost, NEW.vendor, _desc, _date, NEW.id
    )
    ON CONFLICT (maintenance_request_id) DO UPDATE
      SET amount = EXCLUDED.amount,
          vendor = EXCLUDED.vendor,
          description = EXCLUDED.description,
          expense_date = EXCLUDED.expense_date,
          unit_id = EXCLUDED.unit_id,
          building_id = EXCLUDED.building_id,
          category = 'maintenance';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_maintenance_expense ON public.maintenance_requests;
CREATE TRIGGER trg_sync_maintenance_expense
AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_maintenance_expense();