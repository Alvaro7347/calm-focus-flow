import { createFileRoute } from "@tanstack/react-router";
import { SettingsSubpage, ComingSoon } from "@/components/settings/SettingsSubpage";

export const Route = createFileRoute("/ajustes/ia")({
  component: () => (
    <SettingsSubpage
      title="Inteligencia Artificial"
      description="Cómo CalmApp te ayuda con IA."
    >
      <ComingSoon
        items={[
          "Captura por voz",
          "Modelo utilizado",
          "Automatizaciones",
          "Confirmación antes de crear tareas",
        ]}
      />
    </SettingsSubpage>
  ),
});
