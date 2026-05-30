
-- Add per-lease paid_up_to and grace_days to tenancies
ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS paid_up_to date,
  ADD COLUMN IF NOT EXISTS grace_days integer NOT NULL DEFAULT 0;

-- Performance: hot path filter on active payments per lease
CREATE INDEX IF NOT EXISTS idx_payments_tenancy_active
  ON public.payments(tenancy_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.tenancies.paid_up_to IS
  'Last date already paid before this lease started. Arrears accrual starts the day after this date. Optional.';
COMMENT ON COLUMN public.tenancies.grace_days IS
  'Number of grace days after the monthly due_day before the lease becomes overdue.';
