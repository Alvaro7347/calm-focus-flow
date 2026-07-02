-- =========================================================
-- CalmApp — Núcleo operativo (tasks + dominio relacionado)
-- =========================================================

-- Enums
CREATE TYPE public.task_status AS ENUM ('pending', 'completed');
CREATE TYPE public.task_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.task_source AS ENUM ('text', 'voice', 'manual', 'import', 'api');
CREATE TYPE public.capture_source AS ENUM ('text', 'voice');

-- ---------------------------------------------------------
-- capture_sessions (declarada antes que tasks por la FK)
-- ---------------------------------------------------------
CREATE TABLE public.capture_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source public.capture_source NOT NULL,
  transcription TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_sessions TO authenticated;
GRANT ALL ON public.capture_sessions TO service_role;
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own capture_sessions"
  ON public.capture_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own capture_sessions"
  ON public.capture_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own capture_sessions"
  ON public.capture_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own capture_sessions"
  ON public.capture_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_capture_sessions_user_id ON public.capture_sessions(user_id);

-- ---------------------------------------------------------
-- tasks
-- ---------------------------------------------------------
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subproject_id UUID NOT NULL REFERENCES public.subprojects(id) ON DELETE RESTRICT,

  title TEXT NOT NULL,
  description TEXT,

  status public.task_status NOT NULL DEFAULT 'pending',
  blocked_reason TEXT,

  priority public.task_priority NOT NULL DEFAULT 'medium',

  starts_at TIMESTAMPTZ,
  estimated_duration_min INTEGER,
  actual_duration_min INTEGER,
  completed_at TIMESTAMPTZ,

  source public.task_source NOT NULL DEFAULT 'manual',

  capture_session_id UUID REFERENCES public.capture_sessions(id) ON DELETE SET NULL,

  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tasks_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT tasks_completed_consistency CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status = 'pending' AND completed_at IS NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_subproject_id ON public.tasks(subproject_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_starts_at ON public.tasks(starts_at);
CREATE INDEX idx_tasks_completed_at ON public.tasks(completed_at);
CREATE INDEX idx_tasks_archived_at ON public.tasks(archived_at);
CREATE INDEX idx_tasks_capture_session_id ON public.tasks(capture_session_id);

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- attachments
-- ---------------------------------------------------------
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select attachments of own tasks"
  ON public.attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY "Users insert attachments to own tasks"
  ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY "Users update attachments of own tasks"
  ON public.attachments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY "Users delete attachments of own tasks"
  ON public.attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));

CREATE INDEX idx_attachments_task_id ON public.attachments(task_id);

-- ---------------------------------------------------------
-- task_reminders
-- ---------------------------------------------------------
CREATE TABLE public.task_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_reminders TO authenticated;
GRANT ALL ON public.task_reminders TO service_role;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select reminders of own tasks"
  ON public.task_reminders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY "Users insert reminders to own tasks"
  ON public.task_reminders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY "Users update reminders of own tasks"
  ON public.task_reminders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY "Users delete reminders of own tasks"
  ON public.task_reminders FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));

CREATE INDEX idx_task_reminders_task_id ON public.task_reminders(task_id);
CREATE INDEX idx_task_reminders_remind_at ON public.task_reminders(remind_at);

-- ---------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select activity of own tasks"
  ON public.activity_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY "Users insert activity for own tasks"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));

CREATE INDEX idx_activity_log_task_id ON public.activity_log(task_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at);
