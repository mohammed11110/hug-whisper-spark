
-- 1) Maintenance photos: scope writes by uploader (uid in first folder)
DROP POLICY IF EXISTS "Authenticated upload maintenance photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update maintenance photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete maintenance photos" ON storage.objects;
DROP POLICY IF EXISTS "Maintenance photos public read" ON storage.objects;

CREATE POLICY "maintenance-photos public read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'maintenance-photos'
    AND (auth.role() = 'anon' OR (auth.uid())::text = (storage.foldername(name))[1])
  );

CREATE POLICY "maintenance-photos owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "maintenance-photos owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'maintenance-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'maintenance-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "maintenance-photos owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'maintenance-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 2) Branding: restrict SELECT (listing) to owner; public URL serving still works
DROP POLICY IF EXISTS "branding public read" ON storage.objects;

CREATE POLICY "branding owner list"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'branding'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 3) Realtime: deny direct broadcast/presence subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny broadcast and presence" ON realtime.messages;
CREATE POLICY "deny broadcast and presence"
  ON realtime.messages FOR ALL
  TO authenticated, anon
  USING (false) WITH CHECK (false);

-- 4) SECURITY DEFINER execute privileges
REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;

-- 5) Lock search_path on email helper functions
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
