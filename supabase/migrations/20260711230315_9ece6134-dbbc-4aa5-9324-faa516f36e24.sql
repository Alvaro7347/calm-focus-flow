
-- Helper SECURITY DEFINER: comprueba que un subproject pertenece al usuario dado
-- recorriendo subprojects -> projects -> areas.user_id. STABLE + search_path fijado.
CREATE OR REPLACE FUNCTION public.subproject_belongs_to_user(_subproject_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subprojects s
    JOIN public.projects   p ON p.id = s.project_id
    JOIN public.areas      a ON a.id = p.area_id
    WHERE s.id = _subproject_id
      AND a.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.subproject_belongs_to_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subproject_belongs_to_user(uuid, uuid) TO authenticated, service_role;

-- Reemplazar policies de INSERT y UPDATE. SELECT y DELETE se conservan intactas.
DROP POLICY IF EXISTS "Users insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users update own tasks" ON public.tasks;

CREATE POLICY "Users insert own tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.subproject_belongs_to_user(subproject_id, auth.uid())
);

CREATE POLICY "Users update own tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.subproject_belongs_to_user(subproject_id, auth.uid())
);

COMMENT ON FUNCTION public.subproject_belongs_to_user(uuid, uuid) IS
'Devuelve true si el subproject pertenece (vía project.area.user_id) al usuario indicado. Usada por las RLS de public.tasks para evitar cross-user linking.';
