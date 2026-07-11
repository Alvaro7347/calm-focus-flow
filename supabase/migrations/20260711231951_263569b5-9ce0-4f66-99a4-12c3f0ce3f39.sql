
CREATE OR REPLACE FUNCTION public.prevent_event_time_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  conflict_row RECORD;
  detail_json TEXT;
BEGIN
  -- Solo aplica si el registro resultante es un evento activo con horario.
  IF NEW.activity_type <> 'event'
     OR NEW.archived_at IS NOT NULL
     OR NEW.starts_at IS NULL
     OR NEW.ends_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialización por usuario para evitar carreras entre transacciones
  -- concurrentes que intenten insertar/editar eventos solapados. El lock
  -- se libera automáticamente al terminar la transacción.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('calmapp_event_slot:' || NEW.user_id::text, 0)
  );

  -- Búsqueda del primer evento del mismo usuario que se solape usando
  -- intervalos semiabiertos [starts_at, ends_at): tocar exactamente el
  -- borde (12:00 termina, 12:00 empieza) NO es conflicto.
  SELECT id, title, starts_at, ends_at
    INTO conflict_row
    FROM public.tasks
   WHERE user_id = NEW.user_id
     AND activity_type = 'event'
     AND archived_at IS NULL
     AND id <> NEW.id
     AND starts_at IS NOT NULL
     AND ends_at IS NOT NULL
     AND starts_at < NEW.ends_at
     AND ends_at   > NEW.starts_at
   ORDER BY starts_at
   LIMIT 1;

  IF FOUND THEN
    detail_json := json_build_object(
      'conflict_id',    conflict_row.id,
      'conflict_title', conflict_row.title,
      'starts_at',      conflict_row.starts_at,
      'ends_at',        conflict_row.ends_at
    )::text;

    RAISE EXCEPTION 'CALMAPP_EVENT_CONFLICT'
      USING ERRCODE = 'CA001',
            DETAIL  = detail_json,
            HINT    = 'Elige otro horario para este evento.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_event_time_overlap ON public.tasks;

CREATE TRIGGER trg_prevent_event_time_overlap
BEFORE INSERT OR UPDATE OF starts_at, ends_at, activity_type, archived_at, user_id
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.prevent_event_time_overlap();

COMMENT ON FUNCTION public.prevent_event_time_overlap() IS
  'Impide que dos eventos activos del mismo usuario se solapen. Usa intervalos semiabiertos [starts_at, ends_at). Ignora tareas, archivados y otros usuarios. Excluye el propio id al editar. Lanza SQLSTATE CA001 con DETAIL JSON {conflict_id,conflict_title,starts_at,ends_at} cuando hay conflicto.';
