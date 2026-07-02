import { createFileRoute } from "@tanstack/react-router";
import { SettingsSubpage, ComingSoon } from "@/components/settings/SettingsSubpage";

export const Route = createFileRoute("/ajustes/productividad")({
  component: () => (
    <SettingsSubpage
      title="Productividad"
      description="Preferencias sobre cómo trabaja CalmApp para vos."
    >
      <ComingSoon
        items={[
          "Comportamiento de FOCO",
          "Reglas de 'Sin movimiento'",
          "Prioridades por defecto",
        ]}
      />
    </SettingsSubpage>
  ),
});
