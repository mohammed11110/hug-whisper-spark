ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS brand_phone text,
  ADD COLUMN IF NOT EXISTS brand_address text,
  ADD COLUMN IF NOT EXISTS brand_landlord_name text,
  ADD COLUMN IF NOT EXISTS brand_landlord_name_en text,
  ADD COLUMN IF NOT EXISTS brand_logo_path text,
  ADD COLUMN IF NOT EXISTS brand_updated_at timestamptz;