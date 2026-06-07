-- Backfill payments.tenancy_id for legacy rows where it is NULL
-- Match by unit_id + payment_date against the tenancy whose period contains the payment date.
WITH candidates AS (
  SELECT p.id AS payment_id,
         t.id AS tenancy_id,
         ROW_NUMBER() OVER (
           PARTITION BY p.id
           ORDER BY
             -- Prefer tenancy whose period strictly contains the payment date
             CASE WHEN (t.contract_start_date IS NULL OR p.payment_date >= t.contract_start_date)
                   AND (COALESCE(t.ended_at, t.contract_end_date) IS NULL
                        OR p.payment_date <= COALESCE(t.ended_at, t.contract_end_date))
                  THEN 0 ELSE 1 END,
             -- Then prefer the active one
             CASE WHEN t.status = 'active' THEN 0 ELSE 1 END,
             t.contract_start_date DESC NULLS LAST
         ) AS rn
    FROM public.payments p
    JOIN public.tenancies t ON t.unit_id = p.unit_id
   WHERE p.tenancy_id IS NULL
     AND p.deleted_at IS NULL
)
UPDATE public.payments p
   SET tenancy_id = c.tenancy_id
  FROM candidates c
 WHERE c.payment_id = p.id
   AND c.rn = 1;

-- Helpful index for per-lease queries
CREATE INDEX IF NOT EXISTS idx_payments_unit_tenancy ON public.payments (unit_id, tenancy_id) WHERE deleted_at IS NULL;