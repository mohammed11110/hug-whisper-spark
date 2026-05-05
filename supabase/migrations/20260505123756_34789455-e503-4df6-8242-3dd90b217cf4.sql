
REVOKE ALL ON FUNCTION public.is_building_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_building_access(uuid, uuid, public.member_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_invitations_for_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_building_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_building_access(uuid, uuid, public.member_role) TO authenticated;
