-- Attach overlap prevention trigger
DROP TRIGGER IF EXISTS trg_daily_booking_overlap ON public.daily_bookings;
CREATE TRIGGER trg_daily_booking_overlap
  BEFORE INSERT OR UPDATE ON public.daily_bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_daily_booking_overlap();

-- Attach auto-create cleaning task trigger on checkout
DROP TRIGGER IF EXISTS trg_daily_auto_cleaning ON public.daily_bookings;
CREATE TRIGGER trg_daily_auto_cleaning
  AFTER UPDATE ON public.daily_bookings
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_cleaning_task();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_daily_units_updated ON public.daily_units;
CREATE TRIGGER trg_daily_units_updated BEFORE UPDATE ON public.daily_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_bookings_updated ON public.daily_bookings;
CREATE TRIGGER trg_daily_bookings_updated BEFORE UPDATE ON public.daily_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_pricing_rules_updated ON public.daily_pricing_rules;
CREATE TRIGGER trg_daily_pricing_rules_updated BEFORE UPDATE ON public.daily_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_cleaning_tasks_updated ON public.daily_cleaning_tasks;
CREATE TRIGGER trg_daily_cleaning_tasks_updated BEFORE UPDATE ON public.daily_cleaning_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_message_templates_updated ON public.daily_message_templates;
CREATE TRIGGER trg_daily_message_templates_updated BEFORE UPDATE ON public.daily_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Unique constraint to support upsert of templates per building+key
ALTER TABLE public.daily_message_templates
  DROP CONSTRAINT IF EXISTS daily_message_templates_building_key_uniq;
ALTER TABLE public.daily_message_templates
  ADD CONSTRAINT daily_message_templates_building_key_uniq UNIQUE (building_id, key);