
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  country_code TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.phone
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Buildings
CREATE TABLE public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  type TEXT NOT NULL DEFAULT 'tower',
  floors INTEGER NOT NULL DEFAULT 1,
  address TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own buildings" ON public.buildings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX buildings_user_idx ON public.buildings(user_id);

-- Units
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL DEFAULT 1,
  unit_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'apartment',
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_id_type TEXT,
  tenant_id_number TEXT,
  tenant_id_image_url TEXT,
  rent_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  rent_type TEXT NOT NULL DEFAULT 'monthly',
  due_day INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'soon',
  contract_end_date DATE,
  contract_file_url TEXT,
  last_paid_date DATE,
  water_account TEXT,
  electric_account TEXT,
  gas_account TEXT,
  internet_account TEXT,
  handover_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  handover_video_url TEXT,
  legal_case JSONB NOT NULL DEFAULT '{"active": false}'::jsonb,
  utilities JSONB NOT NULL DEFAULT '{"water": false, "electric": false, "gas": false, "net": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own units" ON public.units FOR ALL
  USING (EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = building_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = building_id AND b.user_id = auth.uid()));
CREATE INDEX units_building_idx ON public.units(building_id);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  amount NUMERIC(12,3) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE,
  period_end DATE,
  receipt_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own payments" ON public.payments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE u.id = unit_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.units u JOIN public.buildings b ON b.id = u.building_id WHERE u.id = unit_id AND b.user_id = auth.uid()));
CREATE INDEX payments_unit_idx ON public.payments(unit_id);
