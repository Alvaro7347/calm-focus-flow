
-- Tarea 1: documentar activity_log como log inmutable
COMMENT ON TABLE public.activity_log IS
  'Log de auditoría inmutable. Sin policies de UPDATE/DELETE por diseño: solo se puede insertar y leer. Al eliminar la tarea propietaria, las filas se borran automáticamente por FK ON DELETE CASCADE. No agregar policies de UPDATE ni DELETE.';

-- Tarea 2: reforzar external_research_notes contra filas huérfanas.
-- 0 filas actuales → no requiere backfill.
ALTER TABLE public.external_research_notes
  ALTER COLUMN researcher_user_id SET DEFAULT auth.uid();

ALTER TABLE public.external_research_notes
  ALTER COLUMN researcher_user_id SET NOT NULL;

-- Cambiar FK: ON DELETE SET NULL → ON DELETE CASCADE
-- Evita huérfanos permanentes cuando se elimina la cuenta del investigador.
ALTER TABLE public.external_research_notes
  DROP CONSTRAINT external_research_notes_researcher_user_id_fkey;

ALTER TABLE public.external_research_notes
  ADD CONSTRAINT external_research_notes_researcher_user_id_fkey
  FOREIGN KEY (researcher_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
