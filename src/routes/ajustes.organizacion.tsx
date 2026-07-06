/**
 * Ruta: /ajustes/organizacion
 *
 * Centro de Gestión de Organización de CalmApp.
 * En esta iteración es una vista de solo lectura de la jerarquía
 * Área → Proyecto → Subproyecto. Futuras iteraciones agregarán
 * edición, archivado, colores y proyectos compartidos sobre esta
 * misma estructura sin rediseñar la pantalla.
 */
import { createFileRoute } from "@tanstack/react-router";
import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { OrganizacionTree } from "@/components/settings/OrganizacionTree";

export const Route = createFileRoute("/ajustes/organizacion")({
  head: () => ({
    meta: [
      { title: "Organización — Ajustes — CalmApp" },
      {
        name: "description",
        content:
          "Gestiona la estructura de Áreas, Proyectos y Subproyectos de CalmApp.",
      },
    ],
  }),
  component: () => (
    <SettingsSubpage
      title="Organización"
      description="Áreas, Proyectos y Subproyectos de tu CalmApp."
    >
      <OrganizacionTree />
    </SettingsSubpage>
  ),
});
