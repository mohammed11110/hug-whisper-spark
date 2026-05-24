UPDATE public.units
SET rent_timing = 'advance'
WHERE rent_timing IS NULL
   OR btrim(rent_timing) = ''
   OR lower(rent_timing) NOT IN ('advance', 'arrears');

ALTER TABLE public.units
  ALTER COLUMN rent_timing SET DEFAULT 'advance',
  ALTER COLUMN rent_timing SET NOT NULL;

ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_rent_timing_check;
ALTER TABLE public.units
  ADD CONSTRAINT units_rent_timing_check
  CHECK (rent_timing IN ('advance', 'arrears'));