-- ============================================================
-- ETIQUETAS
--
-- Etiquetas libres del usuario (p. ej. "Instagram", "Contenido",
-- "Análisis") para cruzar y medir el trabajo sin agregar niveles
-- al árbol. Una tarea o evento puede tener VARIAS etiquetas.
--
-- - Son del usuario (no de un Área): "Análisis" sirve igual en
--   Marketing que en Ventas, o en otra Área.
-- - Opcionales: nada existente cambia.
-- - No se borran desde la app: se archivan. Sus asignaciones se
--   conservan como historial.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_user_name_unique
  ON public.tags (user_id, lower(name))
  WHERE archived_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tags" ON public.tags;
CREATE POLICY "Users manage own tags"
  ON public.tags FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS tags_set_updated_at ON public.tags;
CREATE TRIGGER tags_set_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Relación tarea ↔ etiqueta (muchos a muchos)
CREATE TABLE IF NOT EXISTS public.task_tags (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS task_tags_tag_id_idx ON public.task_tags (tag_id);

GRANT SELECT, INSERT, DELETE ON public.task_tags TO authenticated;
GRANT ALL ON public.task_tags TO service_role;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

-- Sólo se puede etiquetar una tarea propia con una etiqueta propia.
DROP POLICY IF EXISTS "Users read own task tags" ON public.task_tags;
CREATE POLICY "Users read own task tags"
  ON public.task_tags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tags t WHERE t.id = task_tags.tag_id AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users insert own task tags" ON public.task_tags;
CREATE POLICY "Users insert own task tags"
  ON public.task_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tags t WHERE t.id = task_tags.tag_id AND t.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.tasks k WHERE k.id = task_tags.task_id AND k.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users delete own task tags" ON public.task_tags;
CREATE POLICY "Users delete own task tags"
  ON public.task_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tags t WHERE t.id = task_tags.tag_id AND t.user_id = auth.uid()));
