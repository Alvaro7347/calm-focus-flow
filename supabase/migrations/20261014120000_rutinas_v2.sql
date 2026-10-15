-- ============================================================
-- RUTINAS v2 — frecuencias y vínculo con Objetivo / Meta
--
-- 1) Frecuencia:
--    - 'weekly'  : ciertos días de la semana (weekdays), cada N semanas.
--    - 'monthly' : un día del mes (month_day 1..31, o -1 = último día),
--                  cada N meses. Si el mes es más corto, cae el último día.
--    interval_count = N (1 = todas las semanas / todos los meses).
--    start_date = desde cuándo corre (ancla para "cada N").
--
-- 2) De dónde cuelga una Rutina:
--    - De una Dimensión (operación: IVA, sueldos…), o
--    - De un Objetivo, y opcionalmente de una de sus Metas (palanca:
--      "Publicar SEO" empuja la Meta "Visitas orgánicas").
--    Debe tener Dimensión u Objetivo. Si cuelga de un Objetivo, la
--    Dimensión es opcional (se usa para contar su tiempo).
--
-- Las Rutinas existentes quedan iguales: semanales, cada 1 semana,
-- desde el día en que se crearon, colgando de su Dimensión.
-- No borra ni mueve datos. Idempotente.
-- ============================================================

-- 1) Columnas nuevas
ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS interval_count SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS month_day SMALLINT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES public.objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;

UPDATE public.routines SET start_date = created_at::date WHERE start_date IS NULL;
ALTER TABLE public.routines ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE public.routines ALTER COLUMN start_date SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS routines_objective_id_idx ON public.routines (objective_id);
CREATE INDEX IF NOT EXISTS routines_goal_id_idx ON public.routines (goal_id);

-- 2) Reglas de frecuencia
ALTER TABLE public.routines DROP CONSTRAINT IF EXISTS routines_frequency_valid;
ALTER TABLE public.routines ADD CONSTRAINT routines_frequency_valid
  CHECK (frequency IN ('weekly', 'monthly'));

ALTER TABLE public.routines DROP CONSTRAINT IF EXISTS routines_interval_valid;
ALTER TABLE public.routines ADD CONSTRAINT routines_interval_valid
  CHECK (interval_count BETWEEN 1 AND 24);

ALTER TABLE public.routines DROP CONSTRAINT IF EXISTS routines_weekdays_valid;
ALTER TABLE public.routines ADD CONSTRAINT routines_weekdays_valid CHECK (
  weekdays <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[]
  AND (frequency <> 'weekly' OR cardinality(weekdays) >= 1)
);

ALTER TABLE public.routines DROP CONSTRAINT IF EXISTS routines_month_day_valid;
ALTER TABLE public.routines ADD CONSTRAINT routines_month_day_valid CHECK (
  (month_day IS NULL OR month_day = -1 OR month_day BETWEEN 1 AND 31)
  AND (frequency <> 'monthly' OR month_day IS NOT NULL)
);

-- 3) Dimensión u Objetivo (al menos uno)
ALTER TABLE public.routines ALTER COLUMN dimension_id DROP NOT NULL;

ALTER TABLE public.routines DROP CONSTRAINT IF EXISTS routines_has_parent;
ALTER TABLE public.routines ADD CONSTRAINT routines_has_parent
  CHECK (dimension_id IS NOT NULL OR objective_id IS NOT NULL);

ALTER TABLE public.routines DROP CONSTRAINT IF EXISTS routines_goal_needs_objective;
ALTER TABLE public.routines ADD CONSTRAINT routines_goal_needs_objective
  CHECK (goal_id IS NULL OR objective_id IS NOT NULL);

-- Nombre único también entre las Rutinas de un mismo Objetivo.
CREATE UNIQUE INDEX IF NOT EXISTS routines_objective_name_unique
  ON public.routines (objective_id, lower(name))
  WHERE archived_at IS NULL AND objective_id IS NOT NULL;

-- 4) Objetivo de la misma Área; Meta de ese Objetivo.
CREATE OR REPLACE FUNCTION public.check_routine_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_area UUID;
  v_objective UUID;
BEGIN
  IF NEW.objective_id IS NOT NULL THEN
    SELECT area_id INTO v_area FROM public.objectives WHERE id = NEW.objective_id;
    IF v_area IS NULL OR v_area <> NEW.area_id THEN
      RAISE EXCEPTION 'El objetivo no pertenece a la misma área de la rutina.'
        USING ERRCODE = 'CA003';
    END IF;
  END IF;

  IF NEW.goal_id IS NOT NULL THEN
    SELECT objective_id INTO v_objective FROM public.goals WHERE id = NEW.goal_id;
    IF v_objective IS NULL OR v_objective <> NEW.objective_id THEN
      RAISE EXCEPTION 'La meta no pertenece al objetivo de la rutina.'
        USING ERRCODE = 'CA003';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS routines_check_links ON public.routines;
CREATE TRIGGER routines_check_links
  BEFORE INSERT OR UPDATE OF area_id, objective_id, goal_id ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.check_routine_links();
