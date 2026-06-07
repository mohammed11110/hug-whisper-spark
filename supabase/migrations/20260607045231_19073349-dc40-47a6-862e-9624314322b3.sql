-- Backfill payments.tenancy_id by matching payment_date to tenancy period.
-- Choose the tenancy on the same unit whose [contract_start_date, COALESCE(ended_at, contract_end_date, 'infinity')] window contains payment_date.
-- If multiple match, prefer the one with the latest contract_start_date.
-- If none match by window, fall back to the nearest tenancy by contract_start_date <= payment_date.

WITH candidates AS (
  SELECT p.id AS payment_id,
         t.id AS tenancy_id,
         t.contract_start_date,
         CASE
           WHEN p.payment_date BETWEEN COALESCE(t.contract_start_date, '-infinity'::date)
                                   AND COALESCE(t.ended_at::date, t.contract_end_date, 'infinity'::date)
             THEN 1
           WHEN t.contract_start_date IS NOT NULL AND p.payment_date >= t.contract_start_date
             THEN 2
           ELSE 3
         END AS match_rank
  FROM public.payments p
  JOIN public.tenancies t ON t.unit_id = p.unit_id
  WHERE p.tenancy_id IS NULL
    AND p.deleted_at IS NULL
),
ranked AS (
  SELECT payment_id, tenancy_id,
         ROW_NUMBER() OVER (
           PARTITION BY payment_id
           ORDER BY match_rank ASC, contract_start_date DESC NULLS LAST
         ) AS rn
  FROM candidates
)
UPDATE public.payments p
   SET tenancy_id = r.tenancy_id
  FROM ranked r
 WHERE r.payment_id = p.id
   AND r.rn = 1
   AND p.tenancy_id IS NULL;
