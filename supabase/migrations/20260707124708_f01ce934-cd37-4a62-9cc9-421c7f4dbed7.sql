
-- tasks: delete own
CREATE POLICY "Users can delete own tasks"
ON public.tasks FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- areas: delete own
CREATE POLICY "Users can delete own areas"
ON public.areas FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- projects: delete own (via parent area ownership)
CREATE POLICY "Users can delete own projects"
ON public.projects FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = projects.area_id AND a.user_id = auth.uid()
  )
);

-- subprojects: delete own (via project -> area ownership)
CREATE POLICY "Users can delete own subprojects"
ON public.subprojects FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = subprojects.project_id AND a.user_id = auth.uid()
  )
);

-- attachments: delete only if the parent task belongs to the user
CREATE POLICY "Users can delete own attachments"
ON public.attachments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = attachments.task_id AND t.user_id = auth.uid()
  )
);

-- task_reminders: delete only if the parent task belongs to the user
CREATE POLICY "Users can delete own task reminders"
ON public.task_reminders FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_reminders.task_id AND t.user_id = auth.uid()
  )
);
