-- 1) Extensión necesaria para GiST sobre UUID
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2) Restricción de exclusión: garantía definitiva de no-solape por usuario.
--    Semiabierto [starts_at, ends_at): bordes exactos NO chocan.
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_no_event_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (
    activity_type = 'event'
    AND archived_at IS NULL
    AND starts_at IS NOT NULL
    AND ends_at IS NOT NULL
  );

-- 3) Trigger: se conserva SOLO para emitir CA001 con detalle humano.
--    Ya NO es la garantía de concurrencia (lo es la EXCLUDE constraint).
--    Se retira `pg_advisory_xact_lock` porque no aportaba correctitud real
--    y podía dar la falsa sensación de seguridad frente a snapshots previos.
CREATE OR REPLACE FUNCTION public.prevent_event_time_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  conflict_row RECORD;
  detail_json TEXT;
BEGIN
  IF NEW.activity_type <> 'event'
     OR NEW.archived_at IS NOT NULL
     OR NEW.starts_at IS NULL
     OR NEW.ends_at IS NULL THEN
    RETURN NEW;
  END IF;

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
$function$;

COMMENT ON CONSTRAINT tasks_no_event_overlap ON public.tasks IS
  'Garantía de concurrencia: impide que un usuario tenga dos eventos activos solapados. El trigger prevent_event_time_overlap solo aporta un mensaje descriptivo (CA001); esta EXCLUDE es la barrera real y produce SQLSTATE 23P01 en carreras concurrentes.';