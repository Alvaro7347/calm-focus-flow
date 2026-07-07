
-- 1) analytics_events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL CHECK (length(event_name) > 0),
  event_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'app',
  route text NULL,
  session_id text NULL,
  experiment_key text NULL,
  experiment_variant text NULL,
  persona_segment text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_events_select_own" ON public.analytics_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "analytics_events_insert_own" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS analytics_events_user_id_created_at_idx
  ON public.analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_event_name_created_at_idx
  ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON public.analytics_events (created_at DESC);

-- 2) user_research_profiles
CREATE TABLE IF NOT EXISTS public.user_research_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_segment text NULL,
  current_tool text NULL,
  main_pain text NULL,
  acquisition_source text NULL,
  willingness_to_pay text NULL,
  test_group text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_research_profiles TO authenticated;
GRANT ALL ON public.user_research_profiles TO service_role;
ALTER TABLE public.user_research_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "urp_select_own" ON public.user_research_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "urp_insert_own" ON public.user_research_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "urp_update_own" ON public.user_research_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER urp_set_updated_at
  BEFORE UPDATE ON public.user_research_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) in_app_survey_responses
CREATE TABLE IF NOT EXISTS public.in_app_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_key text NOT NULL CHECK (length(survey_key) > 0),
  question_key text NOT NULL CHECK (length(question_key) > 0),
  answer_value text NULL,
  answer_number numeric NULL,
  answer_text text NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  route text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.in_app_survey_responses TO authenticated;
GRANT ALL ON public.in_app_survey_responses TO service_role;
ALTER TABLE public.in_app_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iasr_select_own" ON public.in_app_survey_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "iasr_insert_own" ON public.in_app_survey_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS iasr_user_id_created_at_idx
  ON public.in_app_survey_responses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS iasr_survey_key_idx
  ON public.in_app_survey_responses (survey_key, created_at DESC);

-- 4) experiment_assignments
CREATE TABLE IF NOT EXISTS public.experiment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experiment_key text NOT NULL CHECK (length(experiment_key) > 0),
  variant text NOT NULL CHECK (length(variant) > 0),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, experiment_key)
);
GRANT SELECT, INSERT ON public.experiment_assignments TO authenticated;
GRANT ALL ON public.experiment_assignments TO service_role;
ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expa_select_own" ON public.experiment_assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "expa_insert_own" ON public.experiment_assignments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 5) external_research_notes
CREATE TABLE IF NOT EXISTS public.external_research_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  participant_label text NULL,
  participant_segment text NULL,
  research_method text NOT NULL CHECK (length(research_method) > 0),
  hypothesis_area text NULL,
  question_key text NULL,
  answer_text text NULL,
  signal_strength text NULL,
  evidence_type text NULL,
  decision text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_research_notes TO authenticated;
GRANT ALL ON public.external_research_notes TO service_role;
ALTER TABLE public.external_research_notes ENABLE ROW LEVEL SECURITY;
-- Solo el investigador que creó la nota puede verla o modificarla.
CREATE POLICY "ern_select_own" ON public.external_research_notes
  FOR SELECT TO authenticated USING (auth.uid() = researcher_user_id);
CREATE POLICY "ern_insert_own" ON public.external_research_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = researcher_user_id);
CREATE POLICY "ern_update_own" ON public.external_research_notes
  FOR UPDATE TO authenticated USING (auth.uid() = researcher_user_id) WITH CHECK (auth.uid() = researcher_user_id);
CREATE POLICY "ern_delete_own" ON public.external_research_notes
  FOR DELETE TO authenticated USING (auth.uid() = researcher_user_id);
CREATE INDEX IF NOT EXISTS ern_researcher_created_at_idx
  ON public.external_research_notes (researcher_user_id, created_at DESC);
