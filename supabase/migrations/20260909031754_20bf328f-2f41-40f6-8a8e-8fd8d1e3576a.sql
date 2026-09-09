CREATE OR REPLACE FUNCTION private.area_belongs_to_current_user(_area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.areas a
    WHERE a.id = _area_id
      AND a.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.area_belongs_to_current_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.area_belongs_to_current_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.area_belongs_to_current_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.area_belongs_to_current_user(uuid) TO service_role;

DROP POLICY IF EXISTS "Users insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users update own tasks" ON public.tasks;

CREATE POLICY "Users insert own tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND private.area_belongs_to_current_user(area_id)
);

CREATE POLICY "Users update own tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
  AND private.area_belongs_to_current_user(area_id)
);

DROP FUNCTION IF EXISTS private.subproject_belongs_to_current_user(uuid);