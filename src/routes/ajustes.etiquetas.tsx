/**
 * Ruta: /ajustes/etiquetas
 * Gestión de etiquetas: crear, renombrar y archivar.
 */
import { createFileRoute } from "@tanstack/react-router";
import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { EtiquetasManager } from "@/components/etiquetas/EtiquetasManager";

export const Route = createFileRoute("/ajustes/etiquetas")({
  head: () => ({ meta: [{ title: "Etiquetas — Ajustes — CalmApp" }] }),
  component: () => (
    <SettingsSubpage
      title="Etiquetas"
      description="Para cruzar y medir tu trabajo: por canal, por función o como prefieras."
    >
      <EtiquetasManager />
    </SettingsSubpage>
  ),
});
