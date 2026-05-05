ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS contract_start_date date;

UPDATE public.units SET contract_type = COALESCE(rent_type, 'yearly') WHERE contract_type IS NULL OR contract_type = 'yearly';