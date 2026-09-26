/**
 * ========================================================
 * reminderService
 *
 * Alarmas por actividad (tareas y eventos de cualquier
 * vínculo: Proyecto, Objetivo, Hábito o directa de Área).
 *
 * Persistencia: tabla `task_reminders` (ya existente):
 *   - remind_at = starts_at − offset (UTC)
 *   - sent_at   = la marca la Edge Function `push-dispatch`
 *
 * El envío real lo hace `push-dispatch` (cron cada minuto)
 * vía Web Push. Este servicio solo guarda/lee la alarma.
 *
 * Reglas:
 *  - Una sola alarma activa por actividad (se reemplaza).
 *  - Sin hora de inicio no hay alarma.
 *  - El offset no se guarda aparte: se deriva de
 *    (starts_at − remind_at). No requiere migración.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";

/** Minutos de anticipación. `null` = sin alarma. */
export type ReminderOffset = number | null;

export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Sin recordatorio" },
  { value: "0", label: "A la hora de inicio" },
  { value: "5", label: "5 minutos antes" },
  { value: "10", label: "10 minutos antes" },
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 día antes" },
];

export function offsetToValue(offset: ReminderOffset): string {
  return offset == null ? "none" : String(offset);
}

export function valueToOffset(value: string): ReminderOffset {
  if (!value || value === "none") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Devuelve la alarma actual de una actividad (en minutos antes
 * del inicio) o `null` si no tiene.
 */
export async function getTaskReminderOffset(
  taskId: string,
  startsAt: string | null,
): Promise<ReminderOffset> {
  if (!startsAt) return null;
  const { data, error } = await supabase
    .from("task_reminders")
    .select("remind_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const diffMin = Math.round(
    (new Date(startsAt).getTime() - new Date(data.remind_at).getTime()) / 60000,
  );
  return diffMin >= 0 ? diffMin : null;
}

/**
 * Reemplaza la alarma de una actividad. Borra las anteriores y,
 * si corresponde, inserta una nueva (con `sent_at` en null, es
 * decir, "rearmada").
 *
 * No inserta si no hay hora o si la actividad ya comenzó.
 */
export async function setTaskReminder(
  taskId: string,
  startsAt: string | null,
  offset: ReminderOffset,
): Promise<void> {
  const { error: delError } = await supabase
    .from("task_reminders")
    .delete()
    .eq("task_id", taskId);
  if (delError) throw delError;

  if (offset == null || !startsAt) return;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return;
  if (start.getTime() <= Date.now()) return;

  const remindAt = new Date(start.getTime() - offset * 60000).toISOString();
  const { error: insError } = await supabase
    .from("task_reminders")
    .insert({ task_id: taskId, remind_at: remindAt });
  if (insError) throw insError;
}

/**
 * Mantiene la alarma alineada cuando cambia `starts_at` desde
 * cualquier parte de la app (p. ej. otra vista que reprograme).
 * Conserva la misma anticipación. Si la nueva fecha es null,
 * elimina la alarma.
 */
export async function shiftTaskReminder(
  taskId: string,
  oldStartsAt: string | null,
  newStartsAt: string | null,
): Promise<void> {
  if (oldStartsAt === newStartsAt) return;
  const offset = await getTaskReminderOffset(taskId, oldStartsAt);
  if (offset == null) {
    if (!newStartsAt) {
      await supabase.from("task_reminders").delete().eq("task_id", taskId);
    }
    return;
  }
  await setTaskReminder(taskId, newStartsAt, offset);
}
