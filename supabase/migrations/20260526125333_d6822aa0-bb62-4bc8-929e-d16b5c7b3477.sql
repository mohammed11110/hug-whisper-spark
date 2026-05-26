DROP POLICY IF EXISTS "Members read unit_audit_log" ON public.unit_audit_log;

CREATE POLICY "Members read unit_audit_log"
ON public.unit_audit_log
FOR SELECT
USING (
  building_id IS NOT NULL
  AND has_building_access(building_id, auth.uid(), 'viewer'::member_role)
);