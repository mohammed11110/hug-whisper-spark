GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

INSERT INTO public.profiles (id, email, name, trial_started_at, trial_ends_at, subscription_status)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'name', u.email), now(), now() + interval '14 days', 'trial'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;