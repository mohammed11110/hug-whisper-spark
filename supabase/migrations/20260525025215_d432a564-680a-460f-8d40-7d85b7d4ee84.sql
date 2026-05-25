REVOKE EXECUTE ON FUNCTION public.recompute_unit_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_unit_state_from_payments() FROM PUBLIC, anon, authenticated;