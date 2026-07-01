import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/layout/Placeholder";

export const Route = createFileRoute("/crear")({
  head: () => ({ meta: [{ title: "Crear tarea — CalmApp" }] }),
  component: () => <Placeholder titulo="Crear tarea" />,
});
