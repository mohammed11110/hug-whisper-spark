-- Phase 1.1: Remove public access to promo_codes
DROP POLICY IF EXISTS "authenticated can read codes" ON public.promo_codes;

-- Phase 1.2: Fix broken buildings read policy
DROP POLICY IF EXISTS "Members read buildings" ON public.buildings;
CREATE POLICY "Members read buildings" ON public.buildings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.building_members m
    WHERE m.building_id = buildings.id AND m.user_id = auth.uid()
  )
);

-- Phase 1.3: Add SELECT policies for invitations
CREATE POLICY "Owners view invitations" ON public.invitations
FOR SELECT USING (public.is_building_owner(building_id, auth.uid()));

CREATE POLICY "Invitees view own invitations" ON public.invitations
FOR SELECT USING (
  lower(email) = lower((auth.jwt() ->> 'email'))
);

-- Phase 2: Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('contracts', 'contracts', false),
  ('tenant-ids', 'tenant-ids', false),
  ('unit-photos', 'unit-photos', false),
  ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Helper: building_id is the first folder segment in object name
-- Path convention: {building_id}/...

-- contracts policies
CREATE POLICY "contracts read members" ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'viewer'::member_role)
);
CREATE POLICY "contracts write accountants" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'accountant'::member_role)
);
CREATE POLICY "contracts update accountants" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'contracts'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'accountant'::member_role)
);
CREATE POLICY "contracts delete owners" ON storage.objects FOR DELETE
USING (
  bucket_id = 'contracts'
  AND public.is_building_owner(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- tenant-ids policies
CREATE POLICY "tenant-ids read members" ON storage.objects FOR SELECT
USING (
  bucket_id = 'tenant-ids'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'viewer'::member_role)
);
CREATE POLICY "tenant-ids write accountants" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-ids'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'accountant'::member_role)
);
CREATE POLICY "tenant-ids update accountants" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-ids'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'accountant'::member_role)
);
CREATE POLICY "tenant-ids delete owners" ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-ids'
  AND public.is_building_owner(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- unit-photos policies
CREATE POLICY "unit-photos read members" ON storage.objects FOR SELECT
USING (
  bucket_id = 'unit-photos'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'viewer'::member_role)
);
CREATE POLICY "unit-photos write accountants" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'unit-photos'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'accountant'::member_role)
);
CREATE POLICY "unit-photos update accountants" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'unit-photos'
  AND public.has_building_access(((storage.foldername(name))[1])::uuid, auth.uid(), 'accountant'::member_role)
);
CREATE POLICY "unit-photos delete owners" ON storage.objects FOR DELETE
USING (
  bucket_id = 'unit-photos'
  AND public.is_building_owner(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- branding (public read, user-scoped writes by first folder = user_id)
CREATE POLICY "branding public read" ON storage.objects FOR SELECT
USING (bucket_id = 'branding');
CREATE POLICY "branding owner write" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'branding'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "branding owner update" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'branding'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "branding owner delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'branding'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
