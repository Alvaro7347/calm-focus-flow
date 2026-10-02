-- ============================================================
-- DIMENSIONES
--
-- Subdivisión permanente dentro de un Área (p. ej. "Ventas",
-- "Salud"). Estructura:
--
--   ÁREA
--   └── DIMENSIÓN (opcional)
--         ├── PROYECTOS   (projects.dimension_id)
--         ├── OBJETIVOS   (objectives.dimension_id; las Metas heredan)
--         ├── HÁBITOS     (habits.dimension_id)
--         └── TAREAS DIRECTAS (tasks.dimension_id, sólo sin otro vínculo)
--
-- Compatibilidad: todo dimension_id es OPCIONAL. Lo existente queda
-- igual (sin Dimensión). No se crea ni se mueve ningún dato.
-- Las tareas de Etapa/Meta/Hábito NO guardan dimension_id: heredan la
-- Dimensión de su Proyecto/Objetivo/Hábito (sin datos contradictorios).
--
-- Seguridad de datos: una Dimensión no se borra físicamente desde la
-- app (se archiva). Si se borrara, sus elementos quedan sin Dimensión
-- (ON DELETE SET NULL), nunca se eliminan.
-- Idempotente.
-- ============================================================

-- 1) Tabla
CREATE TABLE IF NOT EXISTS public.dimensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dimensions_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS dimensions_area_name_unique
  ON public.dimensions (area_id, lower(name))
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS dimensions_area_id_idx ON public.dimensions (area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dimensions TO authenticated;
GRANT ALL ON public.dimensions TO service_role;

ALTER TABLE public.dimensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dimensions" ON public.dimensions;
CREATE POLICY "Users can view own dimensions"
  ON public.dimensions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = dimensions.area_id AND a.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own dimensions" ON public.dimensions;
CREATE POLICY "Users can insert own dimensions"
  ON public.dimensions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = dimensions.area_id AND a.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own dimensions" ON public.dimensions;
CREATE POLICY "Users can update own dimensions"
  ON public.dimensions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = dimensions.area_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = dimensions.area_id AND a.user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS dimensions_set_updated_at ON public.dimensions;
CREATE TRIGGER dimensions_set_updated_at
  BEFORE UPDATE ON public.dimensions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Columnas opcionales
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS dimension_id UUID REFERENCES public.dimensions(id) ON DELETE SET NULL;
ALTER TABLE public.objectives
  ADD COLUMN IF NOT EXISTS dimension_id UUID REFERENCES public.dimensions(id) ON DELETE SET NULL;
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS dimension_id UUID REFERENCES public.dimensions(id) ON DELETE SET NULL;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS dimension_id UUID REFERENCES public.dimensions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_dimension_id_idx   ON public.projects (dimension_id);
CREATE INDEX IF NOT EXISTS objectives_dimension_id_idx ON public.objectives (dimension_id);
CREATE INDEX IF NOT EXISTS habits_dimension_id_idx     ON public.habits (dimension_id);
CREATE INDEX IF NOT EXISTS tasks_dimension_id_idx      ON public.tasks (dimension_id);

-- 3) Sólo las tareas DIRECTAS guardan Dimensión (las demás heredan).
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_dimension_direct_only;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_dimension_direct_only CHECK (
  dimension_id IS NULL
  OR (subproject_id IS NULL AND goal_id IS NULL AND habit_id IS NULL)
);

-- 4) La Dimensión debe pertenecer a la MISMA Área del elemento.
CREATE OR REPLACE FUNCTION public.check_dimension_same_area()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_area UUID;
BEGIN
  IF NEW.dimension_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT area_id INTO v_area FROM public.dimensions WHERE id = NEW.dimension_id;
  IF v_area IS NULL OR v_area <> NEW.area_id THEN
    RAISE EXCEPTION 'La dimensión no pertenece a la misma área.'
      USING ERRCODE = 'CA002';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_check_dimension_area ON public.projects;
CREATE TRIGGER projects_check_dimension_area
  BEFORE INSERT OR UPDATE OF dimension_id, area_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.check_dimension_same_area();

DROP TRIGGER IF EXISTS objectives_check_dimension_area ON public.objectives;
CREATE TRIGGER objectives_check_dimension_area
  BEFORE INSERT OR UPDATE OF dimension_id, area_id ON public.objectives
  FOR EACH ROW EXECUTE FUNCTION public.check_dimension_same_area();

DROP TRIGGER IF EXISTS habits_check_dimension_area ON public.habits;
CREATE TRIGGER habits_check_dimension_area
  BEFORE INSERT OR UPDATE OF dimension_id, area_id ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.check_dimension_same_area();

DROP TRIGGER IF EXISTS tasks_check_dimension_area ON public.tasks;
CREATE TRIGGER tasks_check_dimension_area
  BEFORE INSERT OR UPDATE OF dimension_id, area_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.check_dimension_same_area();
