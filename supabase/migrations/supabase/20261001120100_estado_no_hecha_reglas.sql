-- ============================================================
-- Reglas para el estado 'not_done' ("No la hice" / "No fui").
--
-- 1) Consistencia: sólo 'completed' lleva completed_at.
-- 2) Progreso: las actividades 'not_done' NO cuentan (ni en el total
--    ni en las completadas), así no bajan el avance de una Meta o
--    Etapa. Si hace falta, el usuario crea otra tarea.
--
-- Se compara con status::text para no depender de que el valor del
-- ENUM esté ya confirmado en esta misma transacción.
-- Idempotente.
-- ============================================================

-- 1) Consistencia completed_at
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_completed_consistency;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_completed_consistency CHECK (
  (status::text = 'completed' AND completed_at IS NOT NULL)
  OR (status::text IN ('pending', 'waiting', 'not_done') AND completed_at IS NULL)
);

-- 2a) Meta: % de tareas completadas (excluye 'not_done')
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

  SELECT count(*) FILTER (WHERE archived_at IS NULL AND activity_type = 'task'
                            AND status::text <> 'not_done'),
         count(*) FILTER (WHERE archived_at IS NULL AND activity_type = 'task'
                            AND status::text = 'completed')
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

-- 2b) Etapa: % de tareas completadas (excluye 'not_done')
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

  SELECT count(*) FILTER (WHERE archived_at IS NULL AND activity_type = 'task'
                            AND status::text <> 'not_done'),
         count(*) FILTER (WHERE archived_at IS NULL AND activity_type = 'task'
                            AND status::text = 'completed')
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
