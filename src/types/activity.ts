/**
 * ========================================================
 * Modelo de dominio: Actividad
 *
 * Una **Actividad** es cualquier ítem creado por el usuario que se
 * comporta como trabajo por hacer. Existen dos variantes, expresadas
 * como *discriminated union* (`tipo`):
 *
 * - `tarea`  → unidad flexible. Puede tener fecha o no, hora o no.
 *              Es la variante por defecto y equivalente al modelo
 *              anterior de "tarea".
 * - `evento` → bloque horario con inicio y fin explícitos. Vive en el
 *              calendario y su duración no se estima: se conoce.
 *
 * Ambas comparten la mayor parte de sus campos y persisten en la
 * tabla `tasks` (una única fuente de verdad). La columna
 * `activity_type` de Supabase discrimina la variante.
 *
 * Compatibilidad:
 * - El tipo `Tarea` (src/types/tarea.ts) mantiene su forma anterior
 *   y añade `tipo` opcional. Todo el código legacy sigue funcionando.
 * - `Activity` es una vista más estricta y tipada del mismo dato.
 * ========================================================
 */

export type ActivityType = "tarea" | "evento";

/** Traducciones estables entre dominio (ES) y persistencia (EN). */
export const ACTIVITY_TYPE_DB = {
  tarea: "task",
  evento: "event",
} as const;

export const ACTIVITY_TYPE_FROM_DB: Record<"task" | "event", ActivityType> = {
  task: "tarea",
  event: "evento",
};
