CREATE TABLE IF NOT EXISTS public.routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
  dimension_id UUID NOT NULL REFERENCES public.dimensions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  weekdays SMALLINT[] NOT NULL DEFAULT '{}',
  start_time TIME,
  duration_min INTEGER,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  tag_ids UUID[] NOT NULL DEFAULT '{}',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT routines_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT routines_weekdays_valid CHECK (
    cardinality(weekdays) >= 1 AND weekdays <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[]
  ),
  CONSTRAINT routines_duration_positive CHECK (duration_min IS NULL OR duration_min > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS routines_dimension_name_unique
  ON public.routines (dimension_id, lower(name))
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS routines_area_id_idx ON public.routines (area_id);
CREATE INDEX IF NOT EXISTS routines_dimension_id_idx ON public.routines (dimension_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT ALL ON public.routines TO service_role;

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own routines" ON public.routines;
CREATE POLICY "Users can view own routines"
  ON public.routines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = routines.area_id AND a.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own routines" ON public.routines;
CREATE POLICY "Users can insert own routines"
  ON public.routines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = routines.area_id AND a.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own routines" ON public.routines;
CREATE POLICY "Users can update own routines"
  ON public.routines FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = routines.area_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = routines.area_id AND a.user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS routines_set_updated_at ON public.routines;
CREATE TRIGGER routines_set_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS routines_check_dimension_area ON public.routines;
CREATE TRIGGER routines_check_dimension_area
  BEFORE INSERT OR UPDATE OF dimension_id, area_id ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.check_dimension_same_area();

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_routine_id_idx ON public.tasks (routine_id);

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_single_link_chk;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_single_link_chk CHECK (
  (CASE WHEN subproject_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN goal_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN habit_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN routine_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
);

CREATE OR REPLACE FUNCTION public.validate_task_area_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stage_area UUID;
  v_goal_area UUID;
  v_habit_area UUID;
  v_routine_area UUID;
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

  IF NEW.routine_id IS NOT NULL THEN
    SELECT r.area_id INTO v_routine_area
    FROM public.routines r
    WHERE r.id = NEW.routine_id;
    IF v_routine_area IS NOT NULL AND v_routine_area <> NEW.area_id THEN
      RAISE EXCEPTION 'El area_id de la tarea no coincide con el Área de su Rutina.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_validate_area_consistency ON public.tasks;
CREATE TRIGGER trg_tasks_validate_area_consistency
  BEFORE INSERT OR UPDATE OF area_id, subproject_id, goal_id, habit_id, routine_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_area_consistency();