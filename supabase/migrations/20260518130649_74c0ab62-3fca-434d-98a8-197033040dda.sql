ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS landlord_name_en text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS tenant_name_en text;
ALTER TABLE public.tenancies ADD COLUMN IF NOT EXISTS tenant_name_en text;