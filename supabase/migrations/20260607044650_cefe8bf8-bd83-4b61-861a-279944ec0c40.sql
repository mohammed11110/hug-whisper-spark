
ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS debt_resolution text,
  ADD COLUMN IF NOT EXISTS debt_settled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS debt_settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS write_off_amount numeric,
  ADD COLUMN IF NOT EXISTS write_off_reason text,
  ADD COLUMN IF NOT EXISTS closing_balance numeric;

ALTER TABLE public.tenancies
  DROP CONSTRAINT IF EXISTS tenancies_debt_resolution_chk;
ALTER TABLE public.tenancies
  ADD CONSTRAINT tenancies_debt_resolution_chk
  CHECK (debt_resolution IS NULL OR debt_resolution IN ('kept','collected','written_off','none'));

CREATE INDEX IF NOT EXISTS idx_tenancies_open_debt
  ON public.tenancies (building_id)
  WHERE status = 'ended' AND debt_settled = false AND COALESCE(closing_balance, 0) > 0;
