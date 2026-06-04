-- 1) Add user_id column to payments to enforce per-account uniqueness
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) Backfill user_id from buildings via units
UPDATE public.payments p
SET user_id = b.user_id
FROM public.units u
JOIN public.buildings b ON b.id = u.building_id
WHERE p.unit_id = u.id AND p.user_id IS NULL;

-- 3) Trigger to always set user_id on insert
CREATE OR REPLACE FUNCTION public.payments_set_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT b.user_id INTO NEW.user_id
    FROM public.units u
    JOIN public.buildings b ON b.id = u.building_id
    WHERE u.id = NEW.unit_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payments_set_user_id ON public.payments;
CREATE TRIGGER trg_payments_set_user_id
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payments_set_user_id();

REVOKE EXECUTE ON FUNCTION public.payments_set_user_id() FROM PUBLIC, anon, authenticated;

-- 4) Cleanup existing duplicate receipt_numbers per user.
DO $$
DECLARE
  r RECORD;
  _start int;
  _prefix text;
  _padding int;
  _base text;
  _padded text;
BEGIN
  FOR r IN
    SELECT id, user_id, receipt_number
    FROM (
      SELECT id, user_id, receipt_number, created_at,
        ROW_NUMBER() OVER (PARTITION BY user_id, receipt_number ORDER BY created_at, id) AS rn
      FROM public.payments
      WHERE deleted_at IS NULL
        AND receipt_number IS NOT NULL
        AND receipt_number <> ''
        AND user_id IS NOT NULL
    ) q
    WHERE rn > 1
    ORDER BY user_id, created_at, id
  LOOP
    INSERT INTO public.receipt_counters(user_id) VALUES (r.user_id) ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.receipt_counters
      SET next_number = next_number + 1,
          updated_at = now()
      WHERE user_id = r.user_id
      RETURNING next_number - 1, prefix, padding INTO _start, _prefix, _padding;

    _padded := CASE WHEN _padding > 0 THEN lpad(_start::text, _padding, '0') ELSE _start::text END;
    _base := CASE WHEN left(_padded, 1) = '0' THEN _padded ELSE '0' || _padded END;
    UPDATE public.payments SET receipt_number = COALESCE(_prefix, '') || _base WHERE id = r.id;
  END LOOP;
END $$;

-- 5) Partial unique index — guarantees the bug can never reproduce, on any account.
CREATE UNIQUE INDEX IF NOT EXISTS payments_user_receipt_unique
  ON public.payments(user_id, receipt_number)
  WHERE deleted_at IS NULL AND receipt_number IS NOT NULL;