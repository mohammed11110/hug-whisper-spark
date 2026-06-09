
-- 1) profiles columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_path text,
  ADD COLUMN IF NOT EXISTS signature_updated_at timestamptz;

-- 2) Storage RLS for the `signatures` bucket
-- Path convention: signatures stored at "{auth.uid()}.png" (root of bucket).
DROP POLICY IF EXISTS "signatures_select_own" ON storage.objects;
CREATE POLICY "signatures_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = split_part(name, '.', 1));

DROP POLICY IF EXISTS "signatures_insert_own" ON storage.objects;
CREATE POLICY "signatures_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = split_part(name, '.', 1));

DROP POLICY IF EXISTS "signatures_update_own" ON storage.objects;
CREATE POLICY "signatures_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = split_part(name, '.', 1))
  WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = split_part(name, '.', 1));

DROP POLICY IF EXISTS "signatures_delete_own" ON storage.objects;
CREATE POLICY "signatures_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = split_part(name, '.', 1));
