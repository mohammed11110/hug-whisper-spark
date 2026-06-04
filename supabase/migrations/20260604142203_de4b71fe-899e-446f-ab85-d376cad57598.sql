CREATE POLICY "members view co-members of their buildings"
ON public.building_members
FOR SELECT
TO authenticated
USING (public.has_building_access(building_id, auth.uid(), 'viewer'));