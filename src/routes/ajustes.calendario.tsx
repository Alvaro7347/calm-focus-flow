import { createFileRoute } from "@tanstack/react-router";
import { SettingsSubpage, ComingSoon } from "@/components/settings/SettingsSubpage";

export const Route = createFileRoute("/ajustes/calendario")({
  component: () => (
    <SettingsSubpage
      title="Calendario"
      description="Integraciones con tus calendarios externos."
    >
      <ComingSoon
        items={[
          "Google Calendar",
          "Outlook",
          "Sincronización bidireccional",
          "Calendario principal",
        ]}
      />
    </SettingsSubpage>
  ),
});
