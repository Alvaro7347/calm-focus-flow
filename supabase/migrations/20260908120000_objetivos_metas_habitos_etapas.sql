-- ============================================================
-- CalmApp — Objetivos, Metas, Hábitos y Etapas
--
-- Introduce el eje "Emoción + estructura":
--   Área → Objetivos → Metas → Tareas
--   Área → Proyectos → Etapas (subprojects) → Tareas
--   Área → Hábitos → Ejecuciones (habit_logs)
--   Área → Tareas directas (sin proyecto/objetivo)
--
-- Progreso: modo mixto (auto/manual) en objectives, goals,
-- projects y subprojects. En modo 'auto' se recalcula solo desde
-- los hijos; en modo 'manual' el usuario lo fija a mano y el
-- recálculo automático se detiene para ese nodo hasta que vuelva
-- a modo 'auto'.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Enum de modo de progreso (compartido por los 4 nodos)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'progress_mode') THEN
    CREATE TYPE public.progress_mode AS ENUM ('auto', 'manual');
  END IF;
END$$;

-- ------------------------------------------------------------
-- 1. OBJECTIVES (Objetivos)
-- ------------------------------------------------------------
CREATE TABLE public.objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  target_date DATE,
  progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (progress_pct >= 0 AND progress_pct <= 100),
  progress_mode public.progress_mode NOT NULL DEFAULT 'auto',
  -- Dimensión emocional: la "situación futura deseada".
  vision_text TEXT,
  vision_image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT objectives_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX objectives_area_name_unique
  ON public.objectives (area_id, lower(name));

CREATE INDEX objectives_area_id_idx     ON public.objectives (area_id);
CREATE INDEX objectives_archived_at_idx ON public.objectives (archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objectives TO authenticated;
GRANT ALL ON public.objectives TO service_role;

ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own objectives"
  ON public.objectives FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = objectives.area_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own objectives"
  ON public.objectives FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = objectives.area_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own objectives"
  ON public.objectives FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = objectives.area_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = objectives.area_id AND a.user_id = auth.uid()
  ));

-- Sin política DELETE: CalmApp es archive-only (ver archived_at).

CREATE TRIGGER objectives_set_updated_at
  BEFORE UPDATE ON public.objectives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 2. GOALS (Metas — construyen el camino de un Objetivo)
-- ------------------------------------------------------------
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  target_date DATE,
  progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (progress_pct >= 0 AND progress_pct <= 100),
  progress_mode public.progress_mode NOT NULL DEFAULT 'auto',
  -- Opcional: una Meta también puede llevar su propia nota emocional.
  vision_text TEXT,
  vision_image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT goals_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX goals_objective_name_unique
  ON public.goals (objective_id, lower(name));

CREATE INDEX goals_objective_id_idx  ON public.goals (objective_id);
CREATE INDEX goals_archived_at_idx   ON public.goals (archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON public.goals FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.objectives o
    JOIN public.areas a ON a.id = o.area_id
    WHERE o.id = goals.objective_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own goals"
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.objectives o
    JOIN public.areas a ON a.id = o.area_id
    WHERE o.id = goals.objective_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own goals"
  ON public.goals FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.objectives o
    JOIN public.areas a ON a.id = o.area_id
    WHERE o.id = goals.objective_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.objectives o
    JOIN public.areas a ON a.id = o.area_id
    WHERE o.id = goals.objective_id AND a.user_id = auth.uid()
  ));

CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 3. HABITS (Hábitos)
-- ------------------------------------------------------------
CREATE TABLE public.habits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  -- "¿Por qué quiero incorporar esto?"
  reason_text TEXT,
  -- "¿Qué futuro estoy construyendo / qué versión de mí quiero desarrollar?"
  desired_future_text TEXT,
  -- Misma forma que RecurrenceRule del frontend (src/types/tarea.ts):
  -- { frecuencia: 'diaria'|'semanal'|'mensual'|'anual', intervalo?, hasta?, diasSemana? }
  frequency_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT habits_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX habits_area_name_unique
  ON public.habits (area_id, lower(name));

CREATE INDEX habits_area_id_idx     ON public.habits (area_id);
CREATE INDEX habits_archived_at_idx ON public.habits (archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habits"
  ON public.habits FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = habits.area_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own habits"
  ON public.habits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = habits.area_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own habits"
  ON public.habits FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = habits.area_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = habits.area_id AND a.user_id = auth.uid()
  ));

CREATE TRIGGER habits_set_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 4. HABIT_LOGS (Ejecuciones de un Hábito)
-- ------------------------------------------------------------
CREATE TABLE public.habit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  done BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT habit_logs_unique_day UNIQUE (habit_id, log_date)
);

CREATE INDEX habit_logs_habit_id_idx  ON public.habit_logs (habit_id);
CREATE INDEX habit_logs_log_date_idx  ON public.habit_logs (log_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habit_logs"
  ON public.habit_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.habits h
    JOIN public.areas a ON a.id = h.area_id
    WHERE h.id = habit_logs.habit_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own habit_logs"
  ON public.habit_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.habits h
    JOIN public.areas a ON a.id = h.area_id
    WHERE h.id = habit_logs.habit_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own habit_logs"
  ON public.habit_logs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.habits h
    JOIN public.areas a ON a.id = h.area_id
    WHERE h.id = habit_logs.habit_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.habits h
    JOIN public.areas a ON a.id = h.area_id
    WHERE h.id = habit_logs.habit_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own habit_logs"
  ON public.habit_logs FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.habits h
    JOIN public.areas a ON a.id = h.area_id
    WHERE h.id = habit_logs.habit_id AND a.user_id = auth.uid()
  ));
-- habit_logs SÍ admite DELETE: des-marcar una ejecución de hoy es una
-- corrección legítima del registro, no un borrado de dominio.

-- ------------------------------------------------------------
-- 5. PROJECTS — progreso + dimensión emocional
-- ------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (progress_pct >= 0 AND progress_pct <= 100),
  ADD COLUMN IF NOT EXISTS progress_mode public.progress_mode NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS vision_text TEXT,
  ADD COLUMN IF NOT EXISTS vision_image_url TEXT;

-- ------------------------------------------------------------
-- 6. SUBPROJECTS — se convierten en "Etapas" (mismo nombre de
--    tabla por compatibilidad con FKs/servicios existentes; la
--    capa de tipos de frontend las expone como `Stage`/Etapa).
-- ------------------------------------------------------------
ALTER TABLE public.subprojects
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (progress_pct >= 0 AND progress_pct <= 100),
  ADD COLUMN IF NOT EXISTS progress_mode public.progress_mode NOT NULL DEFAULT 'auto';

-- ------------------------------------------------------------
-- 7. TASKS — area_id pasa a ser obligatorio (tareas directas);
--    subproject_id deja de ser obligatorio; se agrega goal_id.
-- ------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE RESTRICT;

-- Backfill: toda tarea existente hereda el area_id de su cadena
-- subproject → project → area (hoy subproject_id es NOT NULL para
-- todas las filas existentes, así que el backfill es total).
UPDATE public.tasks t
SET area_id = p.area_id
FROM public.subprojects s
JOIN public.projects p ON p.id = s.project_id
WHERE t.subproject_id = s.id
  AND t.area_id IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN area_id SET NOT NULL;

ALTER TABLE public.tasks
  ALTER COLUMN subproject_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_area_id ON public.tasks (area_id);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON public.tasks (goal_id);

-- Consistencia: si la tarea trae subproject_id (Etapa) o goal_id
-- (Meta), el area_id declarado debe coincidir con el área real de
-- esa Etapa/Meta. Evita que una tarea quede "colgada" en un Área
-- distinta a la de su Proyecto/Objetivo.
CREATE OR REPLACE FUNCTION public.validate_task_area_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stage_area UUID;
  v_goal_area UUID;
BEGIN
  IF NEW.subproject_id IS NOT NULL THEN
    SELECT p.area_id INTO v_stage_area
    FROM public.subprojects s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = NEW.subproject_id;

    IF v_stage_area IS NOT NULL AND v_stage_area <> NEW.area_id THEN
      RAISE EXCEPTION 'El area_id de la tarea no coincide con el Área de su Etapa/Proyecto.';
    END IF;
  END IF;

  IF NEW.goal_id IS NOT NULL THEN
    SELECT o.area_id INTO v_goal_area
    FROM public.goals g
    JOIN public.objectives o ON o.id = g.objective_id
    WHERE g.id = NEW.goal_id;

    IF v_goal_area IS NOT NULL AND v_goal_area <> NEW.area_id THEN
      RAISE EXCEPTION 'El area_id de la tarea no coincide con el Área de su Meta/Objetivo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_validate_area_consistency ON public.tasks;
CREATE TRIGGER trg_tasks_validate_area_consistency
  BEFORE INSERT OR UPDATE OF area_id, subproject_id, goal_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_area_consistency();

-- ============================================================
-- 8. RECÁLCULO DE PROGRESO (modo mixto: auto / manual)
-- ============================================================

-- Meta (goals): % de tareas completadas que cuelgan de ella.
CREATE OR REPLACE FUNCTION public.recalc_goal_progress(p_goal_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_done INTEGER;
  v_pct NUMERIC(5,2);
BEGIN
  IF p_goal_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) FILTER (WHERE archived_at IS NULL AND activity_type = 'task'),
         count(*) FILTER (WHERE archived_at IS NULL AND activity_type = 'task' AND status = 'completed')
  INTO v_total, v_done
  FROM public.tasks
  WHERE goal_id = p_goal_id;

  IF v_total > 0 THEN
    v_pct := round((v_done::numeric / v_total::numeric) * 100, 2);

    UPDATE public.goals
    SET progress_pct = v_pct
    WHERE id = p_goal_id AND progress_mode = 'auto';
  END IF;
END;
$$;

-- Etapa (subprojects): % de tareas completadas que cuelgan de ella.
CREATE OR REPLACE FUNCTION public.recalc_stage_progress(p_stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_done INTEGER;
  v_pct NUMERIC(5,2);
BEGIN
  IF p_stage_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) FILTER (WHERE archived_at IS NULL AND activity_type = 'task'),
         count(*) FILTER (WHERE archived_at IS NULL AND activity_type = 'task' AND status = 'completed')
  INTO v_total, v_done
  FROM public.tasks
  WHERE subproject_id = p_stage_id;

  IF v_total > 0 THEN
    v_pct := round((v_done::numeric / v_total::numeric) * 100, 2);

    UPDATE public.subprojects
    SET progress_pct = v_pct
    WHERE id = p_stage_id AND progress_mode = 'auto';
  END IF;
END;
$$;

-- Objetivo: promedio del progreso de sus Metas activas.
CREATE OR REPLACE FUNCTION public.recalc_objective_progress(p_objective_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC(5,2);
BEGIN
  IF p_objective_id IS NULL THEN
    RETURN;
  END IF;

  SELECT round(avg(progress_pct), 2) INTO v_avg
  FROM public.goals
  WHERE objective_id = p_objective_id AND archived_at IS NULL;

  IF v_avg IS NOT NULL THEN
    UPDATE public.objectives
    SET progress_pct = v_avg
    WHERE id = p_objective_id AND progress_mode = 'auto';
  END IF;
END;
$$;

-- Proyecto: promedio del progreso de sus Etapas activas.
CREATE OR REPLACE FUNCTION public.recalc_project_progress(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC(5,2);
BEGIN
  IF p_project_id IS NULL THEN
    RETURN;
  END IF;

  SELECT round(avg(progress_pct), 2) INTO v_avg
  FROM public.subprojects
  WHERE project_id = p_project_id AND archived_at IS NULL;

  IF v_avg IS NOT NULL THEN
    UPDATE public.projects
    SET progress_pct = v_avg
    WHERE id = p_project_id AND progress_mode = 'auto';
  END IF;
END;
$$;

-- Trigger en tasks: al cambiar status/goal_id/subproject_id/archived_at,
-- recalcula Meta/Etapa afectadas (la anterior y la nueva, por si la
-- tarea cambió de padre) y en cascada su Objetivo/Proyecto.
CREATE OR REPLACE FUNCTION public.trg_tasks_recalc_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_objective_id UUID;
  v_project_id UUID;
BEGIN
  -- NOTA: en PL/pgSQL, OLD no existe en triggers de INSERT y NEW no
  -- existe en triggers de DELETE. Cada rama accede solo al registro
  -- que sí está definido para ese TG_OP.

  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_goal_progress(NEW.goal_id);
    PERFORM public.recalc_stage_progress(NEW.subproject_id);

    SELECT g.objective_id INTO v_objective_id FROM public.goals g WHERE g.id = NEW.goal_id;
    IF v_objective_id IS NOT NULL THEN
      PERFORM public.recalc_objective_progress(v_objective_id);
    END IF;

    SELECT p.id INTO v_project_id FROM public.subprojects s
      JOIN public.projects p ON p.id = s.project_id WHERE s.id = NEW.subproject_id;
    IF v_project_id IS NOT NULL THEN
      PERFORM public.recalc_project_progress(v_project_id);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.recalc_goal_progress(NEW.goal_id);
    PERFORM public.recalc_stage_progress(NEW.subproject_id);

    IF OLD.goal_id IS DISTINCT FROM NEW.goal_id THEN
      PERFORM public.recalc_goal_progress(OLD.goal_id);
    END IF;
    IF OLD.subproject_id IS DISTINCT FROM NEW.subproject_id THEN
      PERFORM public.recalc_stage_progress(OLD.subproject_id);
    END IF;

    SELECT g.objective_id INTO v_objective_id FROM public.goals g WHERE g.id = NEW.goal_id;
    IF v_objective_id IS NOT NULL THEN
      PERFORM public.recalc_objective_progress(v_objective_id);
    END IF;
    IF OLD.goal_id IS DISTINCT FROM NEW.goal_id THEN
      SELECT g.objective_id INTO v_objective_id FROM public.goals g WHERE g.id = OLD.goal_id;
      IF v_objective_id IS NOT NULL THEN
        PERFORM public.recalc_objective_progress(v_objective_id);
      END IF;
    END IF;

    SELECT p.id INTO v_project_id FROM public.subprojects s
      JOIN public.projects p ON p.id = s.project_id WHERE s.id = NEW.subproject_id;
    IF v_project_id IS NOT NULL THEN
      PERFORM public.recalc_project_progress(v_project_id);
    END IF;
    IF OLD.subproject_id IS DISTINCT FROM NEW.subproject_id THEN
      SELECT p.id INTO v_project_id FROM public.subprojects s
        JOIN public.projects p ON p.id = s.project_id WHERE s.id = OLD.subproject_id;
      IF v_project_id IS NOT NULL THEN
        PERFORM public.recalc_project_progress(v_project_id);
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_goal_progress(OLD.goal_id);
    PERFORM public.recalc_stage_progress(OLD.subproject_id);

    SELECT g.objective_id INTO v_objective_id FROM public.goals g WHERE g.id = OLD.goal_id;
    IF v_objective_id IS NOT NULL THEN
      PERFORM public.recalc_objective_progress(v_objective_id);
    END IF;

    SELECT p.id INTO v_project_id FROM public.subprojects s
      JOIN public.projects p ON p.id = s.project_id WHERE s.id = OLD.subproject_id;
    IF v_project_id IS NOT NULL THEN
      PERFORM public.recalc_project_progress(v_project_id);
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_recalc_progress ON public.tasks;
CREATE TRIGGER trg_tasks_recalc_progress
  AFTER INSERT OR UPDATE OF status, goal_id, subproject_id, archived_at OR DELETE
  ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_recalc_progress();

-- Trigger en goals: cuando cambia su progress_pct/archived_at,
-- recalcula el Objetivo padre.
CREATE OR REPLACE FUNCTION public.trg_goals_recalc_objective()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_objective_progress(OLD.objective_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_objective_progress(NEW.objective_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goals_recalc_objective ON public.goals;
CREATE TRIGGER trg_goals_recalc_objective
  AFTER INSERT OR UPDATE OF progress_pct, archived_at, progress_mode OR DELETE
  ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.trg_goals_recalc_objective();

-- Trigger en subprojects (Etapas): cuando cambia su progress_pct/
-- archived_at, recalcula el Proyecto padre.
CREATE OR REPLACE FUNCTION public.trg_stages_recalc_project()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_progress(OLD.project_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_project_progress(NEW.project_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stages_recalc_project ON public.subprojects;
CREATE TRIGGER trg_stages_recalc_project
  AFTER INSERT OR UPDATE OF progress_pct, archived_at, progress_mode OR DELETE
  ON public.subprojects
  FOR EACH ROW EXECUTE FUNCTION public.trg_stages_recalc_project();
