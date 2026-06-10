DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'buildings','units','tenancies','payments','expenses','maintenance_requests',
    'profiles','receipt_counters','in_app_notifications','activity_log',
    'building_members','invitations','unit_audit_log',
    'daily_bookings','daily_units','daily_cleaning_tasks','daily_pricing_rules',
    'daily_message_templates','daily_cleaners'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Set REPLICA IDENTITY FULL so DELETE events carry the old row
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    -- Add to realtime publication if not already a member
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;