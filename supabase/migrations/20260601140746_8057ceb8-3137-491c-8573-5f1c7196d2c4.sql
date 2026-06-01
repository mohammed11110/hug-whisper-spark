-- Plan-based team member limits

CREATE OR REPLACE FUNCTION public.get_plan_member_limit(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _plan
    WHEN 'starter'    THEN 1
    WHEN 'personal'   THEN 1
    WHEN 'pro'        THEN 3
    WHEN 'business'   THEN 10
    WHEN 'enterprise' THEN 2147483647
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_member_allowance(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _phase text;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;
  _phase := public.account_phase(_user_id);
  IF _phase = 'trial' THEN RETURN 2147483647; END IF;
  RETURN public.get_plan_member_limit(public.user_active_plan(_user_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.user_member_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH bs AS (
    SELECT id FROM public.buildings WHERE user_id = _user_id
  ),
  members AS (
    SELECT DISTINCT m.user_id AS key
    FROM public.building_members m
    WHERE m.building_id IN (SELECT id FROM bs)
      AND m.user_id <> _user_id
  ),
  invites AS (
    SELECT DISTINCT lower(i.email) AS key
    FROM public.invitations i
    WHERE i.building_id IN (SELECT id FROM bs)
      AND i.status = 'pending'
      AND lower(i.email) NOT IN (
        SELECT lower(p.email) FROM public.profiles p
        WHERE p.id IN (SELECT user_id FROM public.building_members WHERE building_id IN (SELECT id FROM bs))
      )
  )
  SELECT (SELECT count(*) FROM members)::int + (SELECT count(*) FROM invites)::int;
$$;

CREATE OR REPLACE FUNCTION public.enforce_member_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _allow int;
  _cur int;
BEGIN
  SELECT b.user_id INTO _owner FROM public.buildings b WHERE b.id = NEW.building_id;
  IF _owner IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'invitations' AND NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- Skip if member being added is owner (shouldn't count)
  IF TG_TABLE_NAME = 'building_members' AND NEW.user_id = _owner THEN
    RETURN NEW;
  END IF;

  _allow := public.user_member_allowance(_owner);
  _cur := public.user_member_count(_owner);

  IF _cur + 1 > _allow THEN
    RAISE EXCEPTION 'member_quota_exceeded: allowance=% current=%', _allow, _cur
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_member_quota_bm ON public.building_members;
CREATE TRIGGER enforce_member_quota_bm
  BEFORE INSERT ON public.building_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota();

DROP TRIGGER IF EXISTS enforce_member_quota_inv ON public.invitations;
CREATE TRIGGER enforce_member_quota_inv
  BEFORE INSERT ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota();

GRANT EXECUTE ON FUNCTION public.user_member_allowance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_member_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_member_limit(text) TO authenticated;