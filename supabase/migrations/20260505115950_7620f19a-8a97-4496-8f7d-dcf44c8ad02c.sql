-- Expenses table for buildings/units
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL,
  unit_id UUID,
  category TEXT NOT NULL DEFAULT 'maintenance',
  amount NUMERIC NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  vendor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON public.expenses FOR ALL USING (
  EXISTS (SELECT 1 FROM buildings b WHERE b.id = expenses.building_id AND b.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM buildings b WHERE b.id = expenses.building_id AND b.user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS idx_expenses_building ON public.expenses(building_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);

-- Security deposit fields on units
ALTER TABLE public.units 
  ADD COLUMN IF NOT EXISTS security_deposit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_refunded_at DATE;

-- Partial payments: track expected and paid amounts
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS expected_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS notes TEXT;