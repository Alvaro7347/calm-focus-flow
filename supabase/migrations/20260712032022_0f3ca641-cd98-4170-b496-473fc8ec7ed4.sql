-- =====================================================================
-- Endurece SECURITY DEFINER: mueve subproject_belongs_to_user al
-- esquema privado `private`, actualiza políticas RLS de tasks y
-- elimina superficie de Data API sobre helpers internos.
-- =====================================================================

BEGIN;

-- 1) Esquema privado (no expuesto por PostgREST).
CREATE SCHEMA IF NOT EXISTS private;

-- anon NO debe siquiera resolver nombres en private.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;

-- authenticated necesita USAGE para poder invocar EXECUTE en la función
-- (Postgres exige USAGE en el schema + EXECUTE en la función incluso
-- para SECURITY DEFINER llamada desde políticas RLS).
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- 2) Nueva función en `private`. Firma reducida: toma auth.uid()
--    internamente para evitar que un cliente pueda sondear jerarquías
--    ajenas pasando un user_id arbitrario.
CREATE OR REPLACE FUNCTION private.subproject_belongs_to_current_user(_subproject_id uuid)
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
      AND a.user_id = auth.uid()
  );
$$;

-- Blindaje de EXECUTE: solo authenticated (para las RLS de tasks) y service_role.
REVOKE ALL ON FUNCTION private.subproject_belongs_to_current_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.subproject_belongs_to_current_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.subproject_belongs_to_current_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.subproject_belongs_to_current_user(uuid) TO service_role;

-- 3) Reemplazar políticas RLS de tasks para usar la nueva función.
--    subproject_id es NOT NULL en public.tasks: NO se permite NULL.
DROP POLICY IF EXISTS "Users insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users update own tasks" ON public.tasks;

CREATE POLICY "Users insert own tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND private.subproject_belongs_to_current_user(subproject_id)
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
  AND private.subproject_belongs_to_current_user(subproject_id)
);

-- 4) Eliminar helper antiguo público, ahora sin referentes.
DROP FUNCTION IF EXISTS public.subproject_belongs_to_user(uuid, uuid);

-- 5) Blindaje adicional pedido: revocar cualquier acceso residual a
--    internal_config para roles anónimos/autenticados. RLS ya está
--    activo sin políticas (fail-closed), esto es defensa en profundidad.
REVOKE ALL ON TABLE public.internal_config FROM anon;
REVOKE ALL ON TABLE public.internal_config FROM authenticated;

COMMIT;