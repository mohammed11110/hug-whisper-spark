ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON public.payments(deleted_at);