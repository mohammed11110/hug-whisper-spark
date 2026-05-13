
-- 1) Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Seed admin (first registered user)
INSERT INTO public.user_roles (user_id, role)
VALUES ('3e29b774-7a0d-4dfb-b931-7f1e9d7e0c7e', 'admin')
ON CONFLICT DO NOTHING;

-- 3) Admin overview view (aggregates per user)
CREATE OR REPLACE VIEW public.admin_users_overview
WITH (security_invoker=on) AS
SELECT
  p.id,
  p.name,
  p.email,
  p.phone,
  p.subscription_plan,
  p.subscription_status,
  p.subscription_expires_at,
  p.created_at,
  COALESCE((SELECT count(*) FROM public.buildings b WHERE b.user_id = p.id), 0) AS buildings_count,
  COALESCE((SELECT count(*) FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE b.user_id = p.id), 0) AS units_count,
  COALESCE((SELECT count(*) FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE b.user_id = p.id AND u.tenant_name IS NOT NULL), 0) AS tenants_count
FROM public.profiles p;

-- 4) Admins can read all profiles & promo codes management
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all promo_codes" ON public.promo_codes
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage promo_codes" ON public.promo_codes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
