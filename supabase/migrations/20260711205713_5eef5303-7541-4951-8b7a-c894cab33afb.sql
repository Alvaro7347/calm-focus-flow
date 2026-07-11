-- Discriminated Activity model: split tasks into TASK (flexible) and EVENT (time-boxed).
-- Backwards compatible: existing rows become 'task' by default.

-- 1. Enum for activity kind
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE public.activity_type AS ENUM ('task', 'event');
  END IF;
END$$;

-- 2. Columns on tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS activity_type public.activity_type NOT NULL DEFAULT 'task',
  ADD COLUMN IF NOT EXISTS ends_at timestamptz NULL;

-- 3. Data integrity: an EVENT must have both starts_at and ends_at,
--    and ends_at must be after starts_at. TASK may leave both null.
--    Uses a trigger (CHECK cannot rely on multi-column time logic safely).
CREATE OR REPLACE FUNCTION public.validate_activity_time_range()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.activity_type = 'event' THEN
    IF NEW.starts_at IS NULL OR NEW.ends_at IS NULL THEN
      RAISE EXCEPTION 'Un evento requiere starts_at y ends_at.';
    END IF;
    IF NEW.ends_at <= NEW.starts_at THEN
      RAISE EXCEPTION 'ends_at debe ser posterior a starts_at.';
    END IF;
  ELSE
    -- Tarea: ends_at debe estar vacío para evitar datos ambiguos.
    IF NEW.ends_at IS NOT NULL THEN
      RAISE EXCEPTION 'Una tarea no puede tener ends_at. Cámbiala a evento.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_activity_time_range ON public.tasks;
CREATE TRIGGER trg_validate_activity_time_range
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_activity_time_range();

-- 4. Index útil para consultas por tipo
CREATE INDEX IF NOT EXISTS idx_tasks_activity_type ON public.tasks(activity_type);
