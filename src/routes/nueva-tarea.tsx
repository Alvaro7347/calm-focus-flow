import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/nueva-tarea")({
  head: () => ({ meta: [{ title: "Nueva tarea — CalmApp" }] }),
  component: () => <Navigate to="/crear-tarea" />,
});
