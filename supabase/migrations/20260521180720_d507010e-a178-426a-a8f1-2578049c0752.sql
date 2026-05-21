
-- ============================================================
-- Daily Rentals Module — Phase 1 schema
-- ============================================================

-- 1) daily_units (separate from monthly `units`)
CREATE TABLE public.daily_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  name text NOT NULL,
  name_en text,
  type text NOT NULL DEFAULT 'apartment', -- apartment | studio | villa
  floor integer NOT NULL DEFAULT 1,
  bedrooms integer NOT NULL DEFAULT 1,
  max_guests integer NOT NULL DEFAULT 2,
  base_price numeric NOT NULL DEFAULT 0,
  weekend_multiplier numeric NOT NULL DEFAULT 1.3,
  min_stay_nights integer NOT NULL DEFAULT 1,
  door_code text,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_units_building ON public.daily_units(building_id);

ALTER TABLE public.daily_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read daily_units" ON public.daily_units
  FOR SELECT USING (has_building_access(building_id, auth.uid(), 'viewer'::member_role));
CREATE POLICY "Managers write daily_units" ON public.daily_units
  FOR INSERT WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers update daily_units" ON public.daily_units
  FOR UPDATE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role))
  WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Owner manage daily_units" ON public.daily_units
  FOR ALL USING (is_building_owner(building_id, auth.uid()))
  WITH CHECK (is_building_owner(building_id, auth.uid()));

CREATE TRIGGER trg_daily_units_updated
  BEFORE UPDATE ON public.daily_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) daily_bookings
CREATE TABLE public.daily_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.daily_units(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_phone text,
  guest_email text,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests_count integer NOT NULL DEFAULT 1,
  total_price numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'direct', -- direct | airbnb | booking | whatsapp
  status text NOT NULL DEFAULT 'confirmed', -- pending | confirmed | checked_in | checked_out | cancelled
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);
CREATE INDEX idx_daily_bookings_unit_dates ON public.daily_bookings(unit_id, check_in, check_out);
CREATE INDEX idx_daily_bookings_building ON public.daily_bookings(building_id);

ALTER TABLE public.daily_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read daily_bookings" ON public.daily_bookings
  FOR SELECT USING (has_building_access(building_id, auth.uid(), 'viewer'::member_role));
CREATE POLICY "Managers write daily_bookings" ON public.daily_bookings
  FOR INSERT WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers update daily_bookings" ON public.daily_bookings
  FOR UPDATE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role))
  WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Owner manage daily_bookings" ON public.daily_bookings
  FOR ALL USING (is_building_owner(building_id, auth.uid()))
  WITH CHECK (is_building_owner(building_id, auth.uid()));

CREATE TRIGGER trg_daily_bookings_updated
  BEFORE UPDATE ON public.daily_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: prevent overlapping confirmed bookings on the same unit
CREATE OR REPLACE FUNCTION public.check_daily_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.daily_bookings b
    WHERE b.unit_id = NEW.unit_id
      AND b.id <> NEW.id
      AND b.status <> 'cancelled'
      AND daterange(b.check_in, b.check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)')
  ) THEN
    RAISE EXCEPTION 'booking_overlap: dates overlap with another booking on this unit'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_daily_bookings_no_overlap
  BEFORE INSERT OR UPDATE OF check_in, check_out, unit_id, status ON public.daily_bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_daily_booking_overlap();

-- 3) pricing_rules (seasonal)
CREATE TABLE public.daily_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  unit_id uuid REFERENCES public.daily_units(id) ON DELETE CASCADE, -- null = applies to all units in building
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  price_per_night numeric NOT NULL,
  min_stay integer NOT NULL DEFAULT 1,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_rule_dates CHECK (end_date >= start_date)
);
CREATE INDEX idx_pricing_rules_building ON public.daily_pricing_rules(building_id);

ALTER TABLE public.daily_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read pricing_rules" ON public.daily_pricing_rules
  FOR SELECT USING (has_building_access(building_id, auth.uid(), 'viewer'::member_role));
CREATE POLICY "Managers write pricing_rules" ON public.daily_pricing_rules
  FOR INSERT WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers update pricing_rules" ON public.daily_pricing_rules
  FOR UPDATE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role))
  WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Owner manage pricing_rules" ON public.daily_pricing_rules
  FOR ALL USING (is_building_owner(building_id, auth.uid()))
  WITH CHECK (is_building_owner(building_id, auth.uid()));

CREATE TRIGGER trg_pricing_rules_updated
  BEFORE UPDATE ON public.daily_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) cleaning_tasks
CREATE TABLE public.daily_cleaning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.daily_units(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.daily_bookings(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  assignee_name text,
  assignee_phone text,
  checklist jsonb NOT NULL DEFAULT '[
    {"key":"towels","label":"المناشف","done":false},
    {"key":"linens","label":"الشراشف","done":false},
    {"key":"toiletries","label":"أدوات الاستحمام","done":false},
    {"key":"ac","label":"التكييف","done":false},
    {"key":"kitchen","label":"المطبخ","done":false}
  ]'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | in_progress | done
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cleaning_tasks_building ON public.daily_cleaning_tasks(building_id);
CREATE INDEX idx_cleaning_tasks_unit ON public.daily_cleaning_tasks(unit_id);

ALTER TABLE public.daily_cleaning_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read cleaning_tasks" ON public.daily_cleaning_tasks
  FOR SELECT USING (has_building_access(building_id, auth.uid(), 'viewer'::member_role));
CREATE POLICY "Managers write cleaning_tasks" ON public.daily_cleaning_tasks
  FOR INSERT WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers update cleaning_tasks" ON public.daily_cleaning_tasks
  FOR UPDATE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role))
  WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers delete cleaning_tasks" ON public.daily_cleaning_tasks
  FOR DELETE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Owner manage cleaning_tasks" ON public.daily_cleaning_tasks
  FOR ALL USING (is_building_owner(building_id, auth.uid()))
  WITH CHECK (is_building_owner(building_id, auth.uid()));

CREATE TRIGGER trg_cleaning_tasks_updated
  BEFORE UPDATE ON public.daily_cleaning_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: auto-create cleaning task on checkout
CREATE OR REPLACE FUNCTION public.auto_create_cleaning_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'checked_out' AND (OLD.status IS DISTINCT FROM 'checked_out') THEN
    INSERT INTO public.daily_cleaning_tasks (building_id, unit_id, booking_id, scheduled_date)
    VALUES (NEW.building_id, NEW.unit_id, NEW.id, NEW.check_out);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_daily_bookings_auto_cleaning
  AFTER UPDATE OF status ON public.daily_bookings
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_cleaning_task();

-- 5) message_templates (per building, with sensible defaults seeded on first use)
CREATE TABLE public.daily_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  key text NOT NULL, -- confirmation | checkin | checkout_reminder | thank_you
  title_ar text NOT NULL,
  body_ar text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(building_id, key)
);
CREATE INDEX idx_message_templates_building ON public.daily_message_templates(building_id);

ALTER TABLE public.daily_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read message_templates" ON public.daily_message_templates
  FOR SELECT USING (has_building_access(building_id, auth.uid(), 'viewer'::member_role));
CREATE POLICY "Managers write message_templates" ON public.daily_message_templates
  FOR INSERT WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers update message_templates" ON public.daily_message_templates
  FOR UPDATE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role))
  WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers delete message_templates" ON public.daily_message_templates
  FOR DELETE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Owner manage message_templates" ON public.daily_message_templates
  FOR ALL USING (is_building_owner(building_id, auth.uid()))
  WITH CHECK (is_building_owner(building_id, auth.uid()));

CREATE TRIGGER trg_message_templates_updated
  BEFORE UPDATE ON public.daily_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) cleaners (contact list)
CREATE TABLE public.daily_cleaners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cleaners_building ON public.daily_cleaners(building_id);

ALTER TABLE public.daily_cleaners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read cleaners" ON public.daily_cleaners
  FOR SELECT USING (has_building_access(building_id, auth.uid(), 'viewer'::member_role));
CREATE POLICY "Managers write cleaners" ON public.daily_cleaners
  FOR INSERT WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers update cleaners" ON public.daily_cleaners
  FOR UPDATE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role))
  WITH CHECK (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Managers delete cleaners" ON public.daily_cleaners
  FOR DELETE USING (has_building_access(building_id, auth.uid(), 'manager'::member_role));
CREATE POLICY "Owner manage cleaners" ON public.daily_cleaners
  FOR ALL USING (is_building_owner(building_id, auth.uid()))
  WITH CHECK (is_building_owner(building_id, auth.uid()));
