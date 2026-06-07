
REVOKE SELECT (whatsapp_verification_code, whatsapp_code_expires_at, whatsapp_verification_attempts)
  ON public.profiles FROM anon, authenticated;
