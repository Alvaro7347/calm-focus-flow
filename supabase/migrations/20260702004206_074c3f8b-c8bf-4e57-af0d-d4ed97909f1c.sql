
-- ============================================================
-- AREAS
-- ============================================================
CREATE TABLE public.areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicidad de nombre por usuario (case-insensitive).
CREATE UNIQUE INDEX areas_user_name_unique
  ON public.areas (user_id, lower(name));

CREATE INDEX areas_user_id_idx        ON public.areas (user_id);
CREATE INDEX areas_display_order_idx  ON public.areas (user_id, display_order);
CREATE INDEX areas_archived_at_idx    ON public.areas (archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own areas"
  ON public.areas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own areas"
  ON public.areas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own areas"
  ON public.areas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own areas"
  ON public.areas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER areas_set_updated_at
  BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX projects_area_name_unique
  ON public.projects (area_id, lower(name));

CREATE INDEX projects_area_id_idx        ON public.projects (area_id);
CREATE INDEX projects_display_order_idx  ON public.projects (area_id, display_order);
CREATE INDEX projects_archived_at_idx    ON public.projects (archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS: el proyecto pertenece al usuario dueño del área.
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = projects.area_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = projects.area_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = projects.area_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = projects.area_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = projects.area_id AND a.user_id = auth.uid()
  ));

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SUBPROJECTS
-- ============================================================
CREATE TABLE public.subprojects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subprojects_project_name_unique
  ON public.subprojects (project_id, lower(name));

CREATE INDEX subprojects_project_id_idx      ON public.subprojects (project_id);
CREATE INDEX subprojects_display_order_idx   ON public.subprojects (project_id, display_order);
CREATE INDEX subprojects_archived_at_idx     ON public.subprojects (archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subprojects TO authenticated;
GRANT ALL ON public.subprojects TO service_role;

ALTER TABLE public.subprojects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subprojects"
  ON public.subprojects FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = subprojects.project_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own subprojects"
  ON public.subprojects FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = subprojects.project_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own subprojects"
  ON public.subprojects FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = subprojects.project_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = subprojects.project_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own subprojects"
  ON public.subprojects FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = subprojects.project_id AND a.user_id = auth.uid()
  ));

CREATE TRIGGER subprojects_set_updated_at
  BEFORE UPDATE ON public.subprojects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
