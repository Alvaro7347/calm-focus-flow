import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/layout/Placeholder";

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [{ title: "Calendario — CalmApp" }] }),
  component: () => <Placeholder titulo="Calendario" />,
});
