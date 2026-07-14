/**
 * ========================================================
 * Helper: invalidateActivityGraph
 *
 * Responsabilidad:
 * Punto único para reconciliar la caché de TanStack Query con
 * Supabase tras una mutación exitosa sobre una actividad
 * (Tarea o Evento) o sobre un nodo organizacional que afecte
 * conteos/jerarquía (Área, Proyecto, Subproyecto).
 *
 * Se llama SIEMPRE después de que Supabase confirme el éxito.
 * Nunca antes: si la mutación falla, la caché existente sigue
 * siendo la fuente de verdad y evita mostrar datos falsos.
 *
 * ─────────────────────────────────────────────────────────
 * Queries que forman parte del "grafo de actividades":
 *
 *   ["focus"]                → FOCO (fetchFocusTasks)
 *   ["calendar", ...range]   → Calendario (todas las variantes
 *                              por rango: la invalidación por
 *                              prefijo cubre todas sin conocer
 *                              cada rango).
 *   ["tablero"]              → árbol del Tablero con conteos.
 *   ["areas", "nav"]         → Sidebar / AreasDrawer.
 *   ["organizacion"]         → árbol de Ajustes → Organización
 *                              (conteos y jerarquía).
 *
 * ─────────────────────────────────────────────────────────
 * Queries deliberadamente EXCLUIDAS:
 *
 *   ["profile"], ["auth"], ["research_profile"],
 *   ["survey_responses"]      → no dependen de `tasks`.
 *
 *   dailyBriefCache (localStorage, "Tu Día")
 *     → cache diaria congelada por decisión de producto: el
 *       resumen del día no debe cambiar tras cada mutación.
 *       Se refresca por su TTL y por el usuario, no por este
 *       helper. Si en el futuro se decide invalidarla al
 *       reprogramar, hacerlo con un helper aparte, no acá.
 *
 * ─────────────────────────────────────────────────────────
 * Uso típico:
 *
 *   const saved = await updateTask(id, patch);
 *   await invalidateActivityGraph(queryClient);
 *
 * Con `setQueryData` optimista previo, la invalidación actúa
 * como reconciliación con el servidor: no duplica trabajo,
 * sólo garantiza consistencia.
 * ========================================================
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Claves raíz del grafo. Invalidar por prefijo cubre todas las
 * variantes (p. ej. `["calendar", fromISO, toISO]`).
 */
export const ACTIVITY_GRAPH_QUERY_KEYS: readonly QueryKey[] = [
  ["focus"],
  ["calendar"],
  ["tablero"],
  ["areas", "nav"],
  ["organizacion"],
] as const;

export interface InvalidateActivityGraphOptions {
  /**
   * Si se conoce el id de la actividad afectada, invalidar
   * también su detalle. Hoy `fetchTaskForEdit` no se cachea
   * con Query, así que esta opción es un no-op reservado para
   * cuando se migre; se acepta ya para que los callsites no
   * tengan que cambiar en el futuro.
   */
  activityId?: string;
}

/**
 * Invalida todas las queries del grafo de actividades en
 * paralelo. Debe llamarse SÓLO tras confirmar éxito en Supabase.
 */
export async function invalidateActivityGraph(
  queryClient: QueryClient,
  options: InvalidateActivityGraphOptions = {},
): Promise<void> {
  const jobs = ACTIVITY_GRAPH_QUERY_KEYS.map((key) =>
    queryClient.invalidateQueries({ queryKey: key }),
  );
  if (options.activityId) {
    // Reservado para futuro `["task", id]` cacheado.
    jobs.push(
      queryClient.invalidateQueries({ queryKey: ["task", options.activityId] }),
    );
  }
  await Promise.all(jobs);
}
