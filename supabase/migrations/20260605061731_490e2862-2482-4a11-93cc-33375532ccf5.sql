-- Defense-in-depth: explicit RESTRICTIVE policies block any direct client writes,
-- even if a permissive policy is ever added by mistake.
-- All legitimate writes flow through SECURITY DEFINER functions/triggers (service_role/postgres).

-- activity_log: block direct INSERT/UPDATE/DELETE from clients
DROP POLICY IF EXISTS "Block client writes to activity_log" ON public.activity_log;
CREATE POLICY "Block client writes to activity_log"
ON public.activity_log
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- promo_codes: block direct INSERT/UPDATE/DELETE/SELECT for non-admins;
-- admins keep access via the permissive policies, redemption flows through redeem_promo_code (SECURITY DEFINER).
DROP POLICY IF EXISTS "Block client writes to promo_codes" ON public.promo_codes;
CREATE POLICY "Block client writes to promo_codes"
ON public.promo_codes
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Block client updates to promo_codes" ON public.promo_codes;
CREATE POLICY "Block client updates to promo_codes"
ON public.promo_codes
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Block client deletes to promo_codes" ON public.promo_codes;
CREATE POLICY "Block client deletes to promo_codes"
ON public.promo_codes
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role));
