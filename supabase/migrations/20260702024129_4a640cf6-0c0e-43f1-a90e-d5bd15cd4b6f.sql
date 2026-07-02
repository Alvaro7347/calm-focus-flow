ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_completed_consistency;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_completed_consistency CHECK (
  (status = 'completed'::task_status AND completed_at IS NOT NULL)
  OR (status IN ('pending'::task_status, 'waiting'::task_status) AND completed_at IS NULL)
);