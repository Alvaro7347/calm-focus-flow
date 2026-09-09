-- ============================================================
-- CalmApp — Vínculo directo Tarea → Hábito
--
-- Una tarea puede vincularse a, como máximo, UNO de estos tres
-- caminos (o ninguno, quedando como tarea directa de Área):
--   - Proyecto → Etapa   (tasks.subproject_id)
--   - Objetivo → Meta    (tasks.goal_id)
--   - Hábito             (tasks.habit_id, sin nivel intermedio)
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS habit_id UUID REFERENCES public.habits(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tasks_habit_id ON public.tasks (habit_id);

-- Exclusividad mutua: a lo más uno de los tres vínculos a la vez.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_single_link_chk;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_single_link_chk CHECK (
  (CASE WHEN subproject_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN goal_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN habit_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
);

-- Extiende la validación de consistencia de área para cubrir habit_id
-- (ya cubría subproject_id y goal_id desde la migración anterior).
CREATE OR REPLACE FUNCTION public.validate_task_area_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stage_area UUID;
  v_goal_area UUID;
  v_habit_area UUID;
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

  IF NEW.habit_id IS NOT NULL THEN
    SELECT h.area_id INTO v_habit_area
    FROM public.habits h
    WHERE h.id = NEW.habit_id;

    IF v_habit_area IS NOT NULL AND v_habit_area <> NEW.area_id THEN
      RAISE EXCEPTION 'El area_id de la tarea no coincide con el Área de su Hábito.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_validate_area_consistency ON public.tasks;
CREATE TRIGGER trg_tasks_validate_area_consistency
  BEFORE INSERT OR UPDATE OF area_id, subproject_id, goal_id, habit_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_area_consistency();
