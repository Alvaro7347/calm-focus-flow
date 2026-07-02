/**
 * ========================================================
 * Archivo: priorityMapper
 *
 * Responsabilidad:
 * Traducir la prioridad de una tarea entre el dominio de la
 * base de datos (Supabase) y el dominio utilizado por la
 * interfaz (modelo `Tarea`).
 *
 * Motivación:
 * Ambos dominios NO son el mismo tipo: Supabase habla inglés
 * ('high' | 'medium' | 'low') y la UI habla el dominio
 * histórico en español ('alta' | 'media' | 'baja' | 'normal').
 * Un cast de TypeScript ocultaría esta diferencia y podría
 * romper la UI silenciosamente.
 *
 * Uso:
 * Punto único de conversión. Cuando Calendar y Tablero migren
 * a Supabase deberán reutilizar este mapeo — NO duplicar la
 * tabla de correspondencias en otros archivos.
 *
 * Fallback:
 * Si aparece un valor desconocido (por ejemplo un valor futuro
 * añadido en la DB antes de que la UI lo conozca), se devuelve
 * "normal" como comportamiento seguro. Se registra un warning
 * en consola para facilitar la detección durante desarrollo.
 * ========================================================
 */
import type { Database } from "@/integrations/supabase/types";
import type { Priority } from "@/types/tarea";

/** Dominio de prioridad tal como lo expone Supabase. */
export type DbPriority = Database["public"]["Enums"]["task_priority"];

/**
 * Tabla de correspondencia DB → UI.
 * Mantener sincronizada con el enum `task_priority` de Supabase.
 */
const DB_TO_UI_PRIORITY: Record<DbPriority, Priority> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

/** Valor seguro cuando la prioridad viene nula o desconocida. */
export const DEFAULT_UI_PRIORITY: Priority = "normal";

/**
 * Convierte una prioridad proveniente de Supabase al dominio
 * usado por la UI. Acepta `null | undefined` porque la columna
 * `priority` de `tasks` es opcional en la DB.
 */
export function mapDbPriorityToUi(
  dbPriority: DbPriority | null | undefined
): Priority {
  if (dbPriority == null) return DEFAULT_UI_PRIORITY;
  const mapped = DB_TO_UI_PRIORITY[dbPriority];
  if (mapped) return mapped;
  // Valor desconocido: fallback seguro y aviso en desarrollo.
  console.warn(
    `[priorityMapper] Prioridad desconocida recibida desde la DB: "${dbPriority}". ` +
      `Se usará "${DEFAULT_UI_PRIORITY}" como fallback.`
  );
  return DEFAULT_UI_PRIORITY;
}
