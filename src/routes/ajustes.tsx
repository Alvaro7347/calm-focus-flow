/**
 * ========================================================
 * Ruta layout: /ajustes
 *
 * Pantalla Ajustes de CalmApp — centro de configuración de la
 * aplicación (NO información personal; eso vive en Mi Cuenta).
 *
 * Comportamiento tipo iOS: /ajustes muestra un índice limpio y
 * cada fila abre su propia subruta (/ajustes/apariencia, etc.)
 * mediante `<Outlet />`. La arquitectura queda preparada para
 * crecer en próximos MVP sin rediseñar Ajustes.
 * ========================================================
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — CalmApp" },
      {
        name: "description",
        content: "Centro de configuración de CalmApp.",
      },
    ],
  }),
  component: () => <Outlet />,
});
