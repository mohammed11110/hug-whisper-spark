-- 1) Create tenancies table
CREATE TABLE public.tenancies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id uuid NOT NULL,
  unit_id uuid NOT NULL,

  tenant_name text,
  tenant_phone text,
  tenant_email text,
  tenant_id_type text,
  tenant_id_number text,
  tenant_id_image_url text,

  contract_start_date date,
  contract_end_date date,
  contract_type text NOT NULL DEFAULT 'yearly',

  rent_amount numeric NOT NULL DEFAULT 0,
  rent_type text NOT NULL DEFAULT 'monthly',
  due_day integer NOT NULL DEFAULT 1,

  security_deposit numeric NOT NULL DEFAULT 0,
  deposit_status text NOT NULL DEFAULT 'none',
  deposit_refund_amount numeric,
  deposit_refunded_at date,

  opening_balance numeric NOT NULL DEFAULT 0,
  opening_balance_date date,

  status text NOT NULL DEFAULT 'active',
  ended_at date,
  ended_reason text,
  outstanding_at_end numeric,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One active tenancy per unit
CREATE UNIQUE INDEX tenancies_one_active_per_unit
  ON public.tenancies (unit_id) WHERE status = 'active';

CREATE INDEX tenancies_unit_idx ON public.tenancies (unit_id);
CREATE INDEX tenancies_building_idx ON public.tenancies (building_id);

-- updated_at trigger
CREATE TRIGGER set_tenancies_updated_at
  BEFORE UPDATE ON public.tenancies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read tenancies" ON public.tenancies
  FOR SELECT USING (public.has_building_access(building_id, auth.uid(), 'viewer'::member_role));

CREATE POLICY "Managers insert tenancies" ON public.tenancies
  FOR INSERT WITH CHECK (public.has_building_access(building_id, auth.uid(), 'manager'::member_role));

CREATE POLICY "Managers update tenancies" ON public.tenancies
  FOR UPDATE USING (public.has_building_access(building_id, auth.uid(), 'manager'::member_role))
  WITH CHECK (public.has_building_access(building_id, auth.uid(), 'manager'::member_role));

CREATE POLICY "Owner manage tenancies" ON public.tenancies
  FOR ALL USING (public.is_building_owner(building_id, auth.uid()))
  WITH CHECK (public.is_building_owner(building_id, auth.uid()));

-- 2) Add tenancy_id to payments
ALTER TABLE public.payments ADD COLUMN tenancy_id uuid;
CREATE INDEX payments_tenancy_idx ON public.payments (tenancy_id);

-- 3) Backfill: create active tenancy for each unit that has a tenant
INSERT INTO public.tenancies (
  building_id, unit_id,
  tenant_name, tenant_phone, tenant_email,
  tenant_id_type, tenant_id_number, tenant_id_image_url,
  contract_start_date, contract_end_date, contract_type,
  rent_amount, rent_type, due_day,
  security_deposit, deposit_status, deposit_refunded_at,
  opening_balance, opening_balance_date,
  status
)
SELECT
  u.building_id, u.id,
  u.tenant_name, u.tenant_phone, u.tenant_email,
  u.tenant_id_type, u.tenant_id_number, u.tenant_id_image_url,
  u.contract_start_date, u.contract_end_date, u.contract_type,
  u.rent_amount, u.rent_type, u.due_day,
  u.security_deposit, u.deposit_status, u.deposit_refunded_at,
  u.opening_balance, u.opening_balance_date,
  'active'
FROM public.units u
WHERE u.tenant_name IS NOT NULL AND length(trim(u.tenant_name)) > 0;

-- 4) Backfill payments.tenancy_id from active tenancy of each unit
UPDATE public.payments p
SET tenancy_id = t.id
FROM public.tenancies t
WHERE t.unit_id = p.unit_id
  AND t.status = 'active'
  AND p.tenancy_id IS NULL;