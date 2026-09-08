/**
 * ========================================================
 * Archivo: objectiveService
 *
 * Responsabilidad:
 * Capa de acceso a las tablas `public.objectives` y `public.goals`
 * de Supabase (Objetivos y Metas).
 *
 * Reglas del dominio:
 * - Cada Objetivo pertenece obligatoriamente a un Área (FK).
 * - Cada Meta pertenece obligatoriamente a un Objetivo (FK).
 * - Nombre único dentro de su padre (case-insensitive).
 * - `progress_pct` se recalcula en la base de datos cuando
 *   `progress_mode = 'auto'` (ver triggers de la migración
 *   `objetivos_metas_habitos_etapas`). Este servicio no recalcula
 *   nada en el cliente: solo lee/escribe.
 * - Se archiva con `archived_at`; nunca se elimina físicamente.
 *
 * Sigue el mismo patrón que `projectService`/`subprojectService`
 * para que el resto de la app (Tablero, Crear tarea) pueda tratar
 * Objetivo/Meta de forma consistente con Proyecto/Etapa.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ObjectiveRow,
  ObjectiveInsert,
  ObjectiveUpdate,
  GoalRow,
  GoalInsert,
  GoalUpdate,
  Objetivo,
} from "@/types/objetivo";
import { mapObjectiveRow, mapGoalRow } from "@/types/objetivo";

// ------------------------------------------------------------
// Objectives
// ------------------------------------------------------------

export async function fetchObjectives(
  areaId?: string,
  includeArchived = false,
): Promise<ObjectiveRow[]> {
  let query = supabase
    .from("objectives")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (areaId) query = query.eq("area_id", areaId);
  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ObjectiveRow[];
}

export async function fetchObjectiveById(id: string): Promise<ObjectiveRow | null> {
  const { data, error } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ObjectiveRow | null) ?? null;
}

/**
 * Objetivo + sus Metas, ya mapeados a la vista de dominio `Objetivo`.
 * Es la función que debería consumir la UI (detalle de Objetivo).
 */
export async function fetchObjectiveWithGoals(id: string): Promise<Objetivo | null> {
  const objective = await fetchObjectiveById(id);
  if (!objective) return null;

  const goals = await fetchGoals(id);
  return mapObjectiveRow(
    objective,
    goals.map((g) => mapGoalRow(g)),
  );
}

/**
 * Un Objetivo puede crearse sin Metas todavía (no bloquea la
 * creación rápida); la UI debe invitar a agregar la primera Meta
 * después, pero no debe exigirla en el mismo formulario.
 */
export async function createObjective(input: ObjectiveInsert): Promise<ObjectiveRow> {
  const { data, error } = await supabase
    .from("objectives")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as ObjectiveRow;
}

export async function updateObjective(
  id: string,
  patch: ObjectiveUpdate,
): Promise<ObjectiveRow> {
  const { data, error } = await supabase
    .from("objectives")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ObjectiveRow;
}

export async function archiveObjective(id: string): Promise<ObjectiveRow> {
  return updateObjective(id, { archived_at: new Date().toISOString() });
}

export async function unarchiveObjective(id: string): Promise<ObjectiveRow> {
  return updateObjective(id, { archived_at: null });
}

export async function setObjectiveProgressManual(
  id: string,
  progressPct: number,
): Promise<ObjectiveRow> {
  return updateObjective(id, { progress_pct: progressPct, progress_mode: "manual" });
}

export async function resetObjectiveProgressToAuto(id: string): Promise<ObjectiveRow> {
  return updateObjective(id, { progress_mode: "auto" });
}

// ------------------------------------------------------------
// Goals (Metas)
// ------------------------------------------------------------

export async function fetchGoals(
  objectiveId?: string,
  includeArchived = false,
): Promise<GoalRow[]> {
  let query = supabase
    .from("goals")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (objectiveId) query = query.eq("objective_id", objectiveId);
  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as GoalRow[];
}

export async function fetchGoalById(id: string): Promise<GoalRow | null> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as GoalRow | null) ?? null;
}

export async function createGoal(input: GoalInsert): Promise<GoalRow> {
  const { data, error } = await supabase.from("goals").insert(input).select("*").single();
  if (error) throw error;
  return data as GoalRow;
}

export async function updateGoal(id: string, patch: GoalUpdate): Promise<GoalRow> {
  const { data, error } = await supabase
    .from("goals")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as GoalRow;
}

/**
 * Archiva la Meta. El Objetivo padre recalcula su progreso
 * automáticamente vía trigger (si está en modo `auto`), tomando
 * solo las Metas activas restantes.
 */
export async function archiveGoal(id: string): Promise<GoalRow> {
  return updateGoal(id, { archived_at: new Date().toISOString() });
}

export async function unarchiveGoal(id: string): Promise<GoalRow> {
  return updateGoal(id, { archived_at: null });
}

export async function setGoalProgressManual(
  id: string,
  progressPct: number,
): Promise<GoalRow> {
  return updateGoal(id, { progress_pct: progressPct, progress_mode: "manual" });
}

export async function resetGoalProgressToAuto(id: string): Promise<GoalRow> {
  return updateGoal(id, { progress_mode: "auto" });
}
