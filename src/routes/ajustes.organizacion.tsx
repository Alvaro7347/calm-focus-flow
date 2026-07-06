/**
 * Ruta: /ajustes/organizacion
 *
 * Centro de Gestión de Organización de CalmApp. Permite ver la
 * jerarquía Área → Proyecto → Subproyecto, renombrar cualquier nodo
 * y archivarlo (soft-delete). Al archivar, el nodo y todas sus
 * tareas asociadas se ocultan automáticamente de Sidebar, FOCO,
 * Calendario y Tablero, sin borrar historial.
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
