import { createFileRoute } from "@tanstack/react-router";
import { SettingsSubpage, ComingSoon } from "@/components/settings/SettingsSubpage";

export const Route = createFileRoute("/ajustes/apariencia")({
  component: () => (
    <SettingsSubpage
      title="Apariencia"
      description="Cómo se verá CalmApp."
    >
      <ComingSoon items={["Tema claro", "Tema oscuro", "Seguir sistema"]} />
    </SettingsSubpage>
  ),
});
