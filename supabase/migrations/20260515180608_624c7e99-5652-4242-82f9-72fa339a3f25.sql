
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_whatsapp text,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_verification_code text,
  ADD COLUMN IF NOT EXISTS whatsapp_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_verification_attempts integer NOT NULL DEFAULT 0;
