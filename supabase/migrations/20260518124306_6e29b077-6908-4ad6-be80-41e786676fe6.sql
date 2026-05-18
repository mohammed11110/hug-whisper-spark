
-- 1) Landlord name per building
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS landlord_name text;

-- 2) Maintenance requests
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  unit_id uuid,
  tenant_name text,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost numeric,
  vendor text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manage maintenance" ON public.maintenance_requests
  FOR ALL USING (public.is_building_owner(building_id, auth.uid()))
  WITH CHECK (public.is_building_owner(building_id, auth.uid()));

CREATE POLICY "Members read maintenance" ON public.maintenance_requests
  FOR SELECT USING (public.has_building_access(building_id, auth.uid(), 'viewer'::member_role));

CREATE POLICY "Managers write maintenance" ON public.maintenance_requests
  FOR INSERT WITH CHECK (public.has_building_access(building_id, auth.uid(), 'manager'::member_role));

CREATE POLICY "Managers update maintenance" ON public.maintenance_requests
  FOR UPDATE USING (public.has_building_access(building_id, auth.uid(), 'manager'::member_role))
  WITH CHECK (public.has_building_access(building_id, auth.uid(), 'manager'::member_role));

CREATE TRIGGER set_maintenance_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_maintenance_building ON public.maintenance_requests(building_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON public.maintenance_requests(status);

-- 3) Storage bucket for maintenance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-photos', 'maintenance-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Maintenance photos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'maintenance-photos');

CREATE POLICY "Authenticated upload maintenance photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'maintenance-photos');

CREATE POLICY "Authenticated update maintenance photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'maintenance-photos');

CREATE POLICY "Authenticated delete maintenance photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'maintenance-photos');
