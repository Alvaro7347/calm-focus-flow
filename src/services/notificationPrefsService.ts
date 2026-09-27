/**
 * ========================================================
 * notificationPrefsService
 *
 * Lectura y escritura de `notification_preferences` para el
 * usuario autenticado. Si no existe fila, devuelve los
 * defaults (todo activado).
 *
 * Resúmenes diarios ("secretaria"):
 *  - Matutino:  morning_summary_*   (por defecto 08:00)
 *  - Mediodía:  midday_summary_*    (por defecto 13:00)
 *  - Vespertino: daily_summary_*    (por defecto 18:00, columnas
 *                originales reutilizadas)
 *
 * Tolerante: se lee con `select("*")` para no romper si las
 * columnas nuevas aún no existen (migración pendiente).
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";

export interface NotificationPrefs {
  notifications_enabled: boolean;
  event_reminders_enabled: boolean;
  /** Vespertino (columnas originales). */
  daily_summary_enabled: boolean;
  daily_summary_hour: number;
  daily_summary_minute: number;
  morning_summary_enabled: boolean;
  morning_summary_hour: number;
  morning_summary_minute: number;
  midday_summary_enabled: boolean;
  midday_summary_hour: number;
  midday_summary_minute: number;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  notifications_enabled: true,
  event_reminders_enabled: true,
  daily_summary_enabled: true,
  daily_summary_hour: 18,
  daily_summary_minute: 0,
  morning_summary_enabled: true,
  morning_summary_hour: 8,
  morning_summary_minute: 0,
  midday_summary_enabled: true,
  midday_summary_hour: 13,
  midday_summary_minute: 0,
};

export async function getMyNotificationPrefs(): Promise<NotificationPrefs> {
  const { data: sess } = await supabase.auth.getUser();
  if (!sess.user) return DEFAULT_PREFS;
  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", sess.user.id)
    .maybeSingle();
  if (!data) return DEFAULT_PREFS;
  const row = data as Partial<NotificationPrefs>;
  return {
    notifications_enabled: row.notifications_enabled ?? DEFAULT_PREFS.notifications_enabled,
    event_reminders_enabled: row.event_reminders_enabled ?? DEFAULT_PREFS.event_reminders_enabled,
    daily_summary_enabled: row.daily_summary_enabled ?? DEFAULT_PREFS.daily_summary_enabled,
    daily_summary_hour: row.daily_summary_hour ?? DEFAULT_PREFS.daily_summary_hour,
    daily_summary_minute: row.daily_summary_minute ?? DEFAULT_PREFS.daily_summary_minute,
    morning_summary_enabled: row.morning_summary_enabled ?? DEFAULT_PREFS.morning_summary_enabled,
    morning_summary_hour: row.morning_summary_hour ?? DEFAULT_PREFS.morning_summary_hour,
    morning_summary_minute: row.morning_summary_minute ?? DEFAULT_PREFS.morning_summary_minute,
    midday_summary_enabled: row.midday_summary_enabled ?? DEFAULT_PREFS.midday_summary_enabled,
    midday_summary_hour: row.midday_summary_hour ?? DEFAULT_PREFS.midday_summary_hour,
    midday_summary_minute: row.midday_summary_minute ?? DEFAULT_PREFS.midday_summary_minute,
  };
}

export async function updateMyNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<void> {
  const { data: sess } = await supabase.auth.getUser();
  if (!sess.user) throw new Error("No hay sesión activa.");
  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .eq("user_id", sess.user.id)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("notification_preferences")
      .update(patch)
      .eq("user_id", sess.user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("notification_preferences")
      .insert({ user_id: sess.user.id, ...DEFAULT_PREFS, ...patch });
    if (error) throw error;
  }
}
