/**
 * ========================================================
 * Archivo: focusService
 *
 * Responsabilidad:
 * Fachada de la pantalla FOCO. Consume `taskService.fetchFocusTasks()`
 * (Supabase) y expone la misma interfaz que ya usaba la UI.
 *
 * Reglas:
 * - No accede a mocks ni a Supabase directamente.
 * - Las 4 categorías (Hoy, Esta semana, Esperando, Sin movimiento)
 *   se CALCULAN en `taskService.fetchFocusTasks()` a partir de
 *   `status`, `starts_at` y `updated_at`. Aquí no hay lógica de
 *   negocio adicional.
 * ========================================================
 */
import { fetchFocusTasks, type FocusTasks } from "@/services/taskService";

export type { FocusTasks };

export async function getFocusTasks(): Promise<FocusTasks> {
  return fetchFocusTasks();
}
