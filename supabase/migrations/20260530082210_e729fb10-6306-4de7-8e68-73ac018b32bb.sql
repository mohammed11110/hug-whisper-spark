
-- Drop the FOR ALL policies (which incorrectly blocked SELECT too) and replace
-- with separate INSERT/UPDATE/DELETE policies. SELECT remains fully open via
-- the existing permissive policies.

DO $$
DECLARE _t text;
BEGIN
  FOR _t IN SELECT unnest(ARRAY['buildings','units','payments','expenses','tenancies','maintenance_requests','daily_bookings','daily_units'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Block writes in grace" ON public.%I', _t);
  END LOOP;
END $$;

-- buildings: writes need can_write on the owner (= user_id)
CREATE POLICY "Block insert in grace" ON public.buildings AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.can_write(user_id));
CREATE POLICY "Block update in grace" ON public.buildings AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.can_write(user_id)) WITH CHECK (public.can_write(user_id));
CREATE POLICY "Block delete in grace" ON public.buildings AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.can_write(user_id));

-- Helper inline for building-owned tables
-- units
CREATE POLICY "Block insert in grace" ON public.units AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = units.building_id)));
CREATE POLICY "Block update in grace" ON public.units AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = units.building_id))) WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = units.building_id)));
CREATE POLICY "Block delete in grace" ON public.units AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = units.building_id)));

-- payments
CREATE POLICY "Block insert in grace" ON public.payments AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.can_write((SELECT b.user_id FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE u.id = payments.unit_id)));
CREATE POLICY "Block update in grace" ON public.payments AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.can_write((SELECT b.user_id FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE u.id = payments.unit_id))) WITH CHECK (public.can_write((SELECT b.user_id FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE u.id = payments.unit_id)));
CREATE POLICY "Block delete in grace" ON public.payments AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.can_write((SELECT b.user_id FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE u.id = payments.unit_id)));

-- expenses
CREATE POLICY "Block insert in grace" ON public.expenses AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = expenses.building_id)));
CREATE POLICY "Block update in grace" ON public.expenses AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = expenses.building_id))) WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = expenses.building_id)));
CREATE POLICY "Block delete in grace" ON public.expenses AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = expenses.building_id)));

-- tenancies
CREATE POLICY "Block insert in grace" ON public.tenancies AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = tenancies.building_id)));
CREATE POLICY "Block update in grace" ON public.tenancies AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = tenancies.building_id))) WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = tenancies.building_id)));
CREATE POLICY "Block delete in grace" ON public.tenancies AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = tenancies.building_id)));

-- maintenance_requests
CREATE POLICY "Block insert in grace" ON public.maintenance_requests AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = maintenance_requests.building_id)));
CREATE POLICY "Block update in grace" ON public.maintenance_requests AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = maintenance_requests.building_id))) WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = maintenance_requests.building_id)));
CREATE POLICY "Block delete in grace" ON public.maintenance_requests AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = maintenance_requests.building_id)));

-- daily_bookings
CREATE POLICY "Block insert in grace" ON public.daily_bookings AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_bookings.building_id)));
CREATE POLICY "Block update in grace" ON public.daily_bookings AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_bookings.building_id))) WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_bookings.building_id)));
CREATE POLICY "Block delete in grace" ON public.daily_bookings AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_bookings.building_id)));

-- daily_units
CREATE POLICY "Block insert in grace" ON public.daily_units AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_units.building_id)));
CREATE POLICY "Block update in grace" ON public.daily_units AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_units.building_id))) WITH CHECK (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_units.building_id)));
CREATE POLICY "Block delete in grace" ON public.daily_units AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.can_write((SELECT user_id FROM public.buildings WHERE id = daily_units.building_id)));
