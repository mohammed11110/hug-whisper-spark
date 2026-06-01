CREATE TABLE public.receipt_counters (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefix text NOT NULL DEFAULT 'R-',
  padding int NOT NULL DEFAULT 0,
  start_number int NOT NULL DEFAULT 1,
  next_number int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.receipt_counters TO authenticated;
GRANT ALL ON public.receipt_counters TO service_role;

ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own receipt counter"
  ON public.receipt_counters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own receipt counter"
  ON public.receipt_counters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own receipt counter"
  ON public.receipt_counters FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Atomic allocation
CREATE OR REPLACE FUNCTION public.allocate_receipt_numbers(_delta int DEFAULT 1)
RETURNS TABLE(start_number int, prefix text, padding int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.receipt_counters%ROWTYPE;
  _start int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _delta IS NULL OR _delta < 1 THEN _delta := 1; END IF;

  INSERT INTO public.receipt_counters(user_id) VALUES (_uid)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _row FROM public.receipt_counters WHERE user_id = _uid FOR UPDATE;
  _start := _row.next_number;

  UPDATE public.receipt_counters
     SET next_number = _row.next_number + _delta,
         updated_at = now()
   WHERE user_id = _uid;

  RETURN QUERY SELECT _start, _row.prefix, _row.padding;
END $$;

GRANT EXECUTE ON FUNCTION public.allocate_receipt_numbers(int) TO authenticated;

-- Update settings
CREATE OR REPLACE FUNCTION public.update_receipt_settings(
  _prefix text DEFAULT NULL,
  _padding int DEFAULT NULL,
  _start_number int DEFAULT NULL,
  _reset boolean DEFAULT false
)
RETURNS public.receipt_counters
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.receipt_counters%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  INSERT INTO public.receipt_counters(user_id) VALUES (_uid)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.receipt_counters
     SET prefix = COALESCE(_prefix, prefix),
         padding = COALESCE(_padding, padding),
         start_number = COALESCE(_start_number, start_number),
         next_number = CASE WHEN _reset THEN COALESCE(_start_number, start_number)
                            ELSE next_number END,
         updated_at = now()
   WHERE user_id = _uid
   RETURNING * INTO _row;

  RETURN _row;
END $$;

GRANT EXECUTE ON FUNCTION public.update_receipt_settings(text,int,int,boolean) TO authenticated;

-- Seed counter from existing payments (one-time)
CREATE OR REPLACE FUNCTION public.seed_receipt_counter(_seed int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.receipt_counters(user_id, next_number)
  VALUES (_uid, GREATEST(COALESCE(_seed, 1), 1))
  ON CONFLICT (user_id) DO UPDATE
    SET next_number = GREATEST(public.receipt_counters.next_number, EXCLUDED.next_number),
        updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.seed_receipt_counter(int) TO authenticated;