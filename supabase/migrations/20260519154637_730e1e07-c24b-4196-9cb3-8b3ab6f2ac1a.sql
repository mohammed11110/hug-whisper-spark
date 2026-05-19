-- Accountants: allow update/delete on expenses for buildings they have accountant access to.
CREATE POLICY "Accountants update expenses"
ON public.expenses
FOR UPDATE
TO authenticated
USING (public.has_building_access(building_id, auth.uid(), 'accountant'::public.member_role))
WITH CHECK (public.has_building_access(building_id, auth.uid(), 'accountant'::public.member_role));

CREATE POLICY "Accountants delete expenses"
ON public.expenses
FOR DELETE
TO authenticated
USING (public.has_building_access(building_id, auth.uid(), 'accountant'::public.member_role));

-- Activity log: prevent users from logging activity against buildings they don't belong to.
DROP POLICY IF EXISTS "Users insert own activity" ON public.activity_log;

CREATE POLICY "Users insert own activity"
ON public.activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    building_id IS NULL
    OR public.has_building_access(building_id, auth.uid(), 'viewer'::public.member_role)
  )
);