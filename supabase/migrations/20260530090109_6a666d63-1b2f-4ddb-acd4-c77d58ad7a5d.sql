
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS t
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r' AND n.nspname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.t);
  END LOOP;
END $$;

-- Anon access only for tables with a permissive (non-auth.uid) read policy used by public-facing pages.
GRANT SELECT ON public.email_unsubscribe_tokens TO anon;
GRANT INSERT, UPDATE ON public.email_unsubscribe_tokens TO anon;

-- Sequences referenced by inserts (if any)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', r.sequence_name);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', r.sequence_name);
  END LOOP;
END $$;
