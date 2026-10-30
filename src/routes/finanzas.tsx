/**
 * ========================================================
 * Archivo: routes/finanzas
 *
 * Finanzas del hogar: gestor de gastos personal (ingresos por
 * fuente, cargos fijos, gastos del día a día y tarjeta de crédito).
 * Toda la pantalla vive en `FinanzasScreen`.
 * ========================================================
 */
import { createFileRoute } from "@tanstack/react-router";
import { FinanzasScreen } from "@/components/finanzas/FinanzasScreen";

export const Route = createFileRoute("/finanzas")({
  head: () => ({ meta: [{ title: "Finanzas — CalmApp" }] }),
  component: FinanzasScreen,
});
