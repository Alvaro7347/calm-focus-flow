CREATE TABLE public.activation_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_type text NOT NULL DEFAULT 'aha_first_brain_dump',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  dumped_items_count integer NULL,
  reviewed_items_count integer NULL,
  created_tasks_count integer NULL,
  next_steps_count integer NULL,
  confirmed_next_steps_count integer NULL,
  mental_load_before numeric NULL,
  mental_load_after numeric NULL,
  mental_load_delta numeric NULL,
  status text NOT NULL DEFAULT 'started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.activation_cycles TO authenticated;
GRANT ALL ON public.activation_cycles TO service_role;

ALTER TABLE public.activation_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activation_cycles_select_own"
  ON public.activation_cycles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "activation_cycles_insert_own"
  ON public.activation_cycles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activation_cycles_update_own"
  ON public.activation_cycles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX activation_cycles_user_id_started_at_idx
  ON public.activation_cycles (user_id, started_at DESC);

CREATE INDEX activation_cycles_status_idx
  ON public.activation_cycles (status);

DROP TRIGGER IF EXISTS activation_cycles_set_updated_at ON public.activation_cycles;
CREATE TRIGGER activation_cycles_set_updated_at
  BEFORE UPDATE ON public.activation_cycles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();