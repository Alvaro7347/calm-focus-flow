/**
 * ========================================================
 * Archivo: habitService
 *
 * Responsabilidad:
 * Capa de acceso a las tablas `public.habits` y `public.habit_logs`
 * de Supabase (Hábitos y sus Ejecuciones).
 *
 * Reglas del dominio:
 * - Cada Hábito pertenece obligatoriamente a un Área (FK), no a un
 *   Proyecto ni a un Objetivo.
 * - Nombre único dentro del Área (case-insensitive).
 * - Una Ejecución (`habit_logs`) es única por (habit_id, log_date):
 *   marcar el hábito dos veces el mismo día actualiza el mismo
 *   registro, no crea uno nuevo (`toggleHabitLog` hace upsert).
 * - `habit_logs` sí admite borrado real (des-marcar un día es una
 *   corrección legítima, no un borrado de dominio como en tasks).
 * - El Hábito se archiva con `archived_at`; nunca se elimina.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  HabitRow,
  HabitInsert,
  HabitUpdate,
  HabitLogRow,
} from "@/types/habito";

// ------------------------------------------------------------
// Habits
// ------------------------------------------------------------

export async function fetchHabits(
  areaId?: string,
  includeArchived = false,
): Promise<HabitRow[]> {
  let query = supabase
    .from("habits")
    .select("*")
    .order("created_at", { ascending: true });

  if (areaId) query = query.eq("area_id", areaId);
  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as HabitRow[];
}

export async function fetchHabitById(id: string): Promise<HabitRow | null> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as HabitRow | null) ?? null;
}

export async function createHabit(input: HabitInsert): Promise<HabitRow> {
  const { data, error } = await supabase.from("habits").insert(input).select("*").single();
  if (error) throw error;
  return data as HabitRow;
}

export async function updateHabit(id: string, patch: HabitUpdate): Promise<HabitRow> {
  const { data, error } = await supabase
    .from("habits")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as HabitRow;
}

export async function archiveHabit(id: string): Promise<HabitRow> {
  return updateHabit(id, { archived_at: new Date().toISOString() });
}

export async function unarchiveHabit(id: string): Promise<HabitRow> {
  return updateHabit(id, { archived_at: null });
}

// ------------------------------------------------------------
// Habit logs (Ejecuciones)
// ------------------------------------------------------------

/** Ejecuciones de un Hábito dentro de un rango de fechas [from, to] (inclusive, ISO). */
export async function fetchHabitLogs(
  habitId: string,
  from?: string,
  to?: string,
): Promise<HabitLogRow[]> {
  let query = supabase
    .from("habit_logs")
    .select("*")
    .eq("habit_id", habitId)
    .order("log_date", { ascending: true });

  if (from) query = query.gte("log_date", from);
  if (to) query = query.lte("log_date", to);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as HabitLogRow[];
}

/**
 * Marca o desmarca la ejecución de un Hábito en una fecha dada.
 * Hace upsert sobre la restricción única (habit_id, log_date), así
 * que "tocar el check" el mismo día siempre actualiza el mismo
 * registro en vez de duplicarlo.
 */
export async function toggleHabitLog(
  habitId: string,
  logDate: string,
  done: boolean,
): Promise<HabitLogRow> {
  const { data, error } = await supabase
    .from("habit_logs")
    .upsert({ habit_id: habitId, log_date: logDate, done }, { onConflict: "habit_id,log_date" })
    .select("*")
    .single();
  if (error) throw error;
  return data as HabitLogRow;
}

/** Elimina el registro de ejecución de un día (corrección de registro). */
export async function deleteHabitLog(habitId: string, logDate: string): Promise<void> {
  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("habit_id", habitId)
    .eq("log_date", logDate);
  if (error) throw error;
}
