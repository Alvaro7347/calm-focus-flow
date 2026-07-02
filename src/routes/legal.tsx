/**
 * Ruta layout: /legal
 * Centro Legal de CalmApp. Índice + subrutas (patrón idéntico a /ajustes).
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Centro Legal — CalmApp" },
      {
        name: "description",
        content:
          "Términos, privacidad y licencias de CalmApp en un solo lugar.",
      },
    ],
  }),
  component: () => <Outlet />,
});
