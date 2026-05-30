
REVOKE EXECUTE ON FUNCTION public.subscription_phase(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_data_access(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reactivate_subscription() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscription_phase(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_data_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription() TO authenticated, service_role;
