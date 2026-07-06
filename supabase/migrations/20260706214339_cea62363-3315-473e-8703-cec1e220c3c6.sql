-- Enforce archive-only model at the database layer.
-- Drop permissive DELETE policies on tables that follow the archived_at model
-- or that hang off entities following that model. With RLS enabled and no
-- DELETE policy present, PostgREST will reject any DELETE from authenticated
-- users, matching CalmApp's "archive, never delete" rule.

DROP POLICY IF EXISTS "Users can delete own areas" ON public.areas;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own subprojects" ON public.subprojects;
DROP POLICY IF EXISTS "Users delete own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users delete attachments of own tasks" ON public.attachments;
DROP POLICY IF EXISTS "Users delete reminders of own tasks" ON public.task_reminders;

-- capture_sessions intentionally retains its DELETE policy: it is a transient
-- capture inbox where items are consumed/discarded, not a durable domain entity.
-- activity_log has no DELETE policy (append-only audit trail) — no change needed.