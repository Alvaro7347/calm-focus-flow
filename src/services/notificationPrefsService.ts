/**
 * ========================================================
 * notificationPrefsService
 *
 * Lectura y escritura de `notification_preferences` para el
 * usuario autenticado. Si no existe fila, devuelve los
 * defaults (todo activado, resumen 18:00).
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";

export interface NotificationPrefs {
  notifications_enabled: boolean;
  event_reminders_enabled: boolean;
  daily_summary_enabled: boolean;
  daily_summary_hour: number;
  daily_summary_minute: number;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  notifications_enabled: true,
  event_reminders_enabled: true,
  daily_summary_enabled: true,
  daily_summary_hour: 18,
  daily_summary_minute: 0,
};

export async function getMyNotificationPrefs(): Promise<NotificationPrefs> {
  const { data: sess } = await supabase.auth.getUser();
  if (!sess.user) return DEFAULT_PREFS;
  const { data } = await supabase
    .from("notification_preferences")
    .select("notifications_enabled, event_reminders_enabled, daily_summary_enabled, daily_summary_hour, daily_summary_minute")
    .eq("user_id", sess.user.id)
    .maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return {
    notifications_enabled: data.notifications_enabled,
    event_reminders_enabled: data.event_reminders_enabled,
    daily_summary_enabled: data.daily_summary_enabled,
    daily_summary_hour: data.daily_summary_hour,
    daily_summary_minute: data.daily_summary_minute,
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
