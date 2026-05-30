
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS paid_up_to date;
COMMENT ON COLUMN public.units.paid_up_to IS
  'Mirror of active tenancy.paid_up_to so balance helpers can compute without a join. Updated by NewTenancyDialog and EndTenancyDialog.';
