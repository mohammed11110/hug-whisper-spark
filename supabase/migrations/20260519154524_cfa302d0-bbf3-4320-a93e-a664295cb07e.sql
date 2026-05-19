-- 1. Restrict which profile columns end-users can update.
--    RLS already limits which ROW can be updated; we now also lock down the COLUMNS
--    that contain billing, subscription, and verification state. The service role
--    (used by edge functions) is unaffected.

REVOKE UPDATE ON public.profiles FROM authenticated, anon;

GRANT UPDATE (
  name,
  email,
  phone,
  country_code,
  business_whatsapp,
  updated_at
) ON public.profiles TO authenticated;

-- 2. Restrict storage listing/reads on the maintenance-photos bucket to authenticated
--    members of the relevant building. The bucket stays public for direct CDN URLs,
--    but the storage API will no longer return file metadata to anonymous callers.

DROP POLICY IF EXISTS "maintenance-photos public read" ON storage.objects;

CREATE POLICY "maintenance-photos members read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'maintenance-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id::text = (storage.foldername(name))[2]
        AND public.has_building_access(mr.building_id, auth.uid(), 'viewer'::public.member_role)
    )
  )
);