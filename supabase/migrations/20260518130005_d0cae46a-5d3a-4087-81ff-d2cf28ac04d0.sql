CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  building_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  action text NOT NULL,
  description_ar text,
  description_en text,
  changes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_activity_log_building_created ON public.activity_log (building_id, created_at DESC);
CREATE INDEX idx_activity_log_user_created ON public.activity_log (user_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner sees own activity"
  ON public.activity_log FOR SELECT
  USING (auth.uid() = user_id OR (building_id IS NOT NULL AND has_building_access(building_id, auth.uid(), 'viewer'::member_role)));

CREATE POLICY "Users insert own activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);