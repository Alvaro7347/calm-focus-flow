import { createFileRoute } from "@tanstack/react-router";
import { SettingsSubpage, ComingSoon } from "@/components/settings/SettingsSubpage";

export const Route = createFileRoute("/ajustes/notificaciones")({
  component: () => (
    <SettingsSubpage
      title="Notificaciones"
      description="Cuándo y cómo te avisamos."
    >
      <ComingSoon items={["Recordatorios", "Push", "Email"]} />
    </SettingsSubpage>
  ),
});
