
-- Enforce one active tenancy per unit at the DB level.
-- Any second insert/update that would create a duplicate active row will fail,
-- preventing the silent half-state where the unit shows the new tenant while
-- payments still match an older "active" tenancy.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenancies_unit_one_active
  ON public.tenancies(unit_id)
  WHERE status = 'active';

-- Helpful for the lease-history sidebar on the unit page.
CREATE INDEX IF NOT EXISTS idx_tenancies_unit_ended
  ON public.tenancies(unit_id, ended_at DESC)
  WHERE status = 'ended';
