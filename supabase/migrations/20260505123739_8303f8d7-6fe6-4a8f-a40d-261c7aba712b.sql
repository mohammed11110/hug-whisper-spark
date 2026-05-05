
-- 1) tenant_email on units
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS tenant_email text;

-- 2) Roles enum
DO $$ BEGIN
  CREATE TYPE public.member_role AS ENUM ('manager', 'accountant', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) building_members
CREATE TABLE IF NOT EXISTS public.building_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.member_role NOT NULL DEFAULT 'viewer',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, user_id)
);
ALTER TABLE public.building_members ENABLE ROW LEVEL SECURITY;

-- 4) invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.member_role NOT NULL DEFAULT 'viewer',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 5) Security definer helpers
CREATE OR REPLACE FUNCTION public.is_building_owner(_building_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.buildings WHERE id = _building_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_building_access(_building_id uuid, _user_id uuid, _min_role public.member_role DEFAULT 'viewer')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_building_owner(_building_id, _user_id)
    OR EXISTS (
      SELECT 1 FROM public.building_members m
      WHERE m.building_id = _building_id AND m.user_id = _user_id
        AND CASE _min_role
          WHEN 'viewer' THEN TRUE
          WHEN 'accountant' THEN m.role IN ('manager','accountant')
          WHEN 'manager' THEN m.role = 'manager'
        END
    );
$$;

-- 6) RLS for building_members
DROP POLICY IF EXISTS "owner manage members" ON public.building_members;
CREATE POLICY "owner manage members" ON public.building_members
FOR ALL USING (public.is_building_owner(building_id, auth.uid()))
WITH CHECK (public.is_building_owner(building_id, auth.uid()));

DROP POLICY IF EXISTS "members view themselves" ON public.building_members;
CREATE POLICY "members view themselves" ON public.building_members
FOR SELECT USING (user_id = auth.uid());

-- 7) RLS for invitations
DROP POLICY IF EXISTS "owner manage invitations" ON public.invitations;
CREATE POLICY "owner manage invitations" ON public.invitations
FOR ALL USING (public.is_building_owner(building_id, auth.uid()))
WITH CHECK (public.is_building_owner(building_id, auth.uid()));

-- 8) Extend RLS on buildings to include members
DROP POLICY IF EXISTS "Users manage own buildings" ON public.buildings;
CREATE POLICY "Owner full access" ON public.buildings
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members read buildings" ON public.buildings
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.building_members m WHERE m.building_id = id AND m.user_id = auth.uid())
);

-- 9) Extend RLS on units to include members
DROP POLICY IF EXISTS "Users manage own units" ON public.units;
CREATE POLICY "Owner manage units" ON public.units
FOR ALL USING (public.is_building_owner(building_id, auth.uid()))
WITH CHECK (public.is_building_owner(building_id, auth.uid()));
CREATE POLICY "Members read units" ON public.units
FOR SELECT USING (public.has_building_access(building_id, auth.uid(), 'viewer'));
CREATE POLICY "Managers update units" ON public.units
FOR UPDATE USING (public.has_building_access(building_id, auth.uid(), 'manager'))
WITH CHECK (public.has_building_access(building_id, auth.uid(), 'manager'));

-- 10) Extend RLS on payments to include members
DROP POLICY IF EXISTS "Users manage own payments" ON public.payments;
CREATE POLICY "Owner manage payments" ON public.payments
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.units u JOIN public.buildings b ON b.id = u.building_id
          WHERE u.id = payments.unit_id AND b.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.units u JOIN public.buildings b ON b.id = u.building_id
          WHERE u.id = payments.unit_id AND b.user_id = auth.uid())
);
CREATE POLICY "Members read payments" ON public.payments
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.units u WHERE u.id = payments.unit_id
          AND public.has_building_access(u.building_id, auth.uid(), 'viewer'))
);
CREATE POLICY "Accountants insert payments" ON public.payments
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.units u WHERE u.id = payments.unit_id
          AND public.has_building_access(u.building_id, auth.uid(), 'accountant'))
);
CREATE POLICY "Accountants update payments" ON public.payments
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.units u WHERE u.id = payments.unit_id
          AND public.has_building_access(u.building_id, auth.uid(), 'accountant'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.units u WHERE u.id = payments.unit_id
          AND public.has_building_access(u.building_id, auth.uid(), 'accountant'))
);

-- 11) Extend RLS on expenses to include members
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Owner manage expenses" ON public.expenses
FOR ALL USING (public.is_building_owner(building_id, auth.uid()))
WITH CHECK (public.is_building_owner(building_id, auth.uid()));
CREATE POLICY "Members read expenses" ON public.expenses
FOR SELECT USING (public.has_building_access(building_id, auth.uid(), 'viewer'));
CREATE POLICY "Accountants write expenses" ON public.expenses
FOR INSERT WITH CHECK (public.has_building_access(building_id, auth.uid(), 'accountant'));

-- 12) Auto-accept invitations: when a user signs up with an invited email, add membership
CREATE OR REPLACE FUNCTION public.accept_invitations_for_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.building_members (building_id, user_id, role, invited_by)
  SELECT i.building_id, NEW.id, i.role, i.invited_by
  FROM public.invitations i
  WHERE lower(i.email) = lower(NEW.email) AND i.status = 'pending'
  ON CONFLICT (building_id, user_id) DO NOTHING;

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE lower(email) = lower(NEW.email) AND status = 'pending';

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_profile_created_accept_invites ON public.profiles;
CREATE TRIGGER on_profile_created_accept_invites
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.accept_invitations_for_user();
