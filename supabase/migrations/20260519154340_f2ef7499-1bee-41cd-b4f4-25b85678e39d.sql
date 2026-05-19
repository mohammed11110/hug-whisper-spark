-- Revoke EXECUTE from anon/authenticated for SECURITY DEFINER functions that are not meant
-- to be invoked from clients. These are either internal trigger functions or service-role
-- helpers, so they should not be exposed via PostgREST.

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.accept_invitations_for_user() FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, public;