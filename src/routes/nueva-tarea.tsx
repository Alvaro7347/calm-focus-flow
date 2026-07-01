import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/layout/Placeholder";

export const Route = createFileRoute("/nueva-tarea")({
  head: () => ({ meta: [{ title: "Nueva tarea — CalmApp" }] }),
  component: () => <Placeholder titulo="Nueva tarea" />,
});
