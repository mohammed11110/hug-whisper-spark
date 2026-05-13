ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS opening_balance numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS opening_balance_date date;