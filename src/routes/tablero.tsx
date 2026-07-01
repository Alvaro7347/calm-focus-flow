import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/layout/Placeholder";

export const Route = createFileRoute("/tablero")({
  head: () => ({ meta: [{ title: "Tablero — CalmApp" }] }),
  component: () => <Placeholder titulo="Tablero" />,
});
