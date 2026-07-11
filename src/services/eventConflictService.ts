/**
 * ========================================================
 * eventConflictService
 *
 * Detección de conflictos horarios entre eventos del usuario
 * autenticado. La regla canónica vive en la base de datos
 * (trigger `prevent_event_time_overlap`, SQLSTATE `CA001`).
 * Este servicio ofrece:
 *
 * - `findEventConflict()`: pre-chequeo antes de guardar para
 *   dar al usuario un mensaje concreto sin generar un error
 *   ruidoso. NO reemplaza al trigger — la BD es la garantía
 *   final ante concurrencia.
 * - `parseEventConflictError()`: interpreta el error del
 *   trigger cuando el pre-chequeo se salta o queda obsoleto
 *   entre chequeo y guardado.
 *
 * Regla de solapamiento (intervalos semiabiertos):
 *   nuevo.starts_at <  existente.ends_at
 *   nuevo.ends_at   >  existente.starts_at
 * Los bordes exactos (12:00–13:00 tras 09:00–12:00) NO chocan.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";

export interface EventConflict {
  id: string;
  title: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
}

/**
 * Busca el primer evento activo del usuario autenticado que
 * se solape con el rango dado. Devuelve `null` si no hay conflicto.
 *
 * @param startsAtIso Inicio propuesto (ISO).
 * @param endsAtIso   Fin propuesto (ISO).
 * @param excludeId   Al editar, id del propio evento (se excluye).
 */
export async function findEventConflict(
  startsAtIso: string,
  endsAtIso: string,
  excludeId?: string | null,
): Promise<EventConflict | null> {
  let query = supabase
    .from("tasks")
    .select("id, title, starts_at, ends_at")
    .eq("activity_type", "event")
    .is("archived_at", null)
    .not("starts_at", "is", null)
    .not("ends_at", "is", null)
    // Semiabierto: existente.starts_at < nuevo.ends_at
    .lt("starts_at", endsAtIso)
    // Semiabierto: existente.ends_at > nuevo.starts_at
    .gt("ends_at", startsAtIso)
    .order("starts_at", { ascending: true })
    .limit(1);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw error;
  const row = data?.[0];
  if (!row || !row.starts_at || !row.ends_at) return null;
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

/** Formato humano corto para horas: 09:30. */
function formatHm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Mensaje calmado y concreto para mostrar al usuario cuando
 * hay conflicto. Si falta el detalle, cae a un mensaje genérico.
 */
export function buildConflictMessage(conflict: EventConflict | null): string {
  if (!conflict) {
    return "No pudimos guardar este evento porque coincide con otro compromiso de tu calendario. Elige otro horario para continuar.";
  }
  const from = formatHm(conflict.startsAt);
  const to = formatHm(conflict.endsAt);
  const title = conflict.title?.trim() || "otro evento";
  return `No pudimos guardar este evento porque coincide con “${title}”, programado de ${from} a ${to}. Elige otro horario para continuar.`;
}

/**
 * Intenta parsear el error del trigger `prevent_event_time_overlap`.
 * Devuelve el conflicto embebido en `error.details` cuando el
 * código del error es `CA001`. Cualquier otro error devuelve `null`.
 */
export function parseEventConflictError(err: unknown): EventConflict | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: string; details?: string | null };
  if (e.code !== "CA001") return null;
  const raw = e.details;
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as {
      conflict_id?: string;
      conflict_title?: string;
      starts_at?: string;
      ends_at?: string;
    };
    if (!parsed.conflict_id || !parsed.starts_at || !parsed.ends_at) return null;
    return {
      id: parsed.conflict_id,
      title: parsed.conflict_title ?? "",
      startsAt: parsed.starts_at,
      endsAt: parsed.ends_at,
    };
  } catch {
    return null;
  }
}
