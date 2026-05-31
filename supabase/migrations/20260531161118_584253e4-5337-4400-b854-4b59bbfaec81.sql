
-- 1. Sequence for contract numbers
CREATE SEQUENCE IF NOT EXISTS public.tenancy_contract_seq START 1;

-- 2. Columns
ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS official_contract_number text;

-- 3. Backfill existing rows (ordered by created_at) using year of creation
WITH numbered AS (
  SELECT id,
         EXTRACT(YEAR FROM created_at)::int AS yr,
         ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.tenancies
  WHERE contract_number IS NULL
)
UPDATE public.tenancies t
   SET contract_number = 'AML-' || n.yr || '-' || LPAD(n.rn::text, 4, '0')
  FROM numbered n
 WHERE t.id = n.id;

-- Advance sequence past the highest backfilled number so future inserts don't collide
SELECT setval('public.tenancy_contract_seq',
              GREATEST(1, (SELECT COUNT(*) FROM public.tenancies)));

-- 4. Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS tenancies_contract_number_key
  ON public.tenancies(contract_number);

-- 5. Generator function + trigger
CREATE OR REPLACE FUNCTION public.set_contract_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seq bigint;
BEGIN
  IF NEW.contract_number IS NULL OR length(trim(NEW.contract_number)) = 0 THEN
    _seq := nextval('public.tenancy_contract_seq');
    NEW.contract_number := 'AML-' || EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
                           || '-' || LPAD(_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenancies_set_contract_number ON public.tenancies;
CREATE TRIGGER tenancies_set_contract_number
BEFORE INSERT ON public.tenancies
FOR EACH ROW
EXECUTE FUNCTION public.set_contract_number();
