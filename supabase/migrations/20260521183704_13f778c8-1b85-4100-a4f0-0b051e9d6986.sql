ALTER TABLE public.daily_units
  ADD COLUMN IF NOT EXISTS source_unit_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS daily_units_source_unit_uniq
  ON public.daily_units(source_unit_id)
  WHERE source_unit_id IS NOT NULL;