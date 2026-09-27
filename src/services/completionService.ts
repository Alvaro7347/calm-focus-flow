/**
 * ========================================================
 * Archivo: completionService — Completar Proyectos, Metas y Objetivos
 *
 * Sin cambios en Supabase. "Completado" se representa con lo que
 * ya existe:
 *
 *  - Proyecto:  tareas pendientes → completadas, progreso fijo en
 *               100 % (manual) y archivado. Archivado + 100 % =
 *               completado (archivado sin 100 % = archivado a secas).
 *  - Meta:      tareas pendientes → completadas y progreso fijo en
 *               100 % (manual). NO se archiva: una Meta archivada
 *               dejaría de contar en el promedio del Objetivo
 *               (recalc_objective_progress sólo promedia las activas).
 *  - Objetivo:  se completan todas sus Metas activas (con sus
 *               tareas), progreso fijo en 100 % y archivado.
 *
 * Fechas: "iniciado" = created_at; "terminado" = archived_at
 * (Proyecto/Objetivo). Reabrir revierte archivado y progreso manual;
 * las tareas completadas se conservan como historial.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import {
  archiveProject,
  unarchiveProject,
  setProjectProgressManual,
  resetProjectProgressToAuto,
} from "@/services/projectService";
import {
  archiveObjective,
  unarchiveObjective,
  setObjectiveProgressManual,
  resetObjectiveProgressToAuto,
  setGoalProgressManual,
  resetGoalProgressToAuto,
} from "@/services/objectiveService";

export type CompletableKind = "project" | "goal" | "objective";

export interface CompletionPreview {
  createdAt: string | null;
  /** Tareas pendientes o en espera que se marcarán como completadas. */
  pendingTasks: number;
  /** Tareas ya completadas antes de cerrar. */
  completedTasks: number;
  /** Eventos futuros vinculados (dejarán de verse al archivar). */
  futureEvents: number;
}

type Scope = { column: "subproject_id" | "goal_id"; ids: string[] };

async function resolveScope(kind: CompletableKind, id: string): Promise<Scope> {
  if (kind === "project") {
    const { data, error } = await supabase
      .from("subprojects")
      .select("id")
      .eq("project_id", id)
      .is("archived_at", null);
    if (error) throw error;
    return { column: "subproject_id", ids: (data ?? []).map((r) => r.id) };
  }
  if (kind === "goal") return { column: "goal_id", ids: [id] };
  const { data, error } = await supabase
    .from("goals")
    .select("id")
    .eq("objective_id", id)
    .is("archived_at", null);
  if (error) throw error;
  return { column: "goal_id", ids: (data ?? []).map((r) => r.id) };
}

async function countTasks(
  scope: Scope,
  filter: "pending" | "completed" | "futureEvents",
): Promise<number> {
  if (scope.ids.length === 0) return 0;
  let q = supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in(scope.column, scope.ids)
    .is("archived_at", null);
  if (filter === "pending") {
    q = q.eq("activity_type", "task").in("status", ["pending", "waiting"]);
  } else if (filter === "completed") {
    q = q.eq("activity_type", "task").eq("status", "completed");
  } else {
    q = q.eq("activity_type", "event").gt("starts_at", new Date().toISOString());
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function fetchCreatedAt(kind: CompletableKind, id: string): Promise<string | null> {
  const table = kind === "project" ? "projects" : kind === "goal" ? "goals" : "objectives";
  const { data } = await supabase.from(table).select("created_at").eq("id", id).maybeSingle();
  return data?.created_at ?? null;
}

export async function getCompletionPreview(
  kind: CompletableKind,
  id: string,
): Promise<CompletionPreview> {
  const scope = await resolveScope(kind, id);
  const [createdAt, pendingTasks, completedTasks, futureEvents] = await Promise.all([
    fetchCreatedAt(kind, id),
    countTasks(scope, "pending"),
    countTasks(scope, "completed"),
    // Las Metas no se archivan: sus eventos futuros siguen visibles.
    kind === "goal" ? Promise.resolve(0) : countTasks(scope, "futureEvents"),
  ]);
  return { createdAt, pendingTasks, completedTasks, futureEvents };
}

/** Marca como completadas todas las tareas pendientes/en espera del alcance. */
async function completePendingTasks(scope: Scope): Promise<number> {
  if (scope.ids.length === 0) return 0;
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .in(scope.column, scope.ids)
    .eq("activity_type", "task")
    .in("status", ["pending", "waiting"])
    .is("archived_at", null)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function completeProject(id: string): Promise<void> {
  await completePendingTasks(await resolveScope("project", id));
  await setProjectProgressManual(id, 100);
  await archiveProject(id);
}

export async function completeGoal(id: string): Promise<void> {
  await completePendingTasks({ column: "goal_id", ids: [id] });
  await setGoalProgressManual(id, 100);
}

export async function completeObjective(id: string): Promise<void> {
  const scope = await resolveScope("objective", id);
  await completePendingTasks(scope);
  for (const goalId of scope.ids) {
    await setGoalProgressManual(goalId, 100);
  }
  await setObjectiveProgressManual(id, 100);
  await archiveObjective(id);
}

export async function completeItem(kind: CompletableKind, id: string): Promise<void> {
  if (kind === "project") return completeProject(id);
  if (kind === "goal") return completeGoal(id);
  return completeObjective(id);
}

export async function reopenProject(id: string): Promise<void> {
  await unarchiveProject(id);
  await resetProjectProgressToAuto(id);
}

export async function reopenGoal(id: string): Promise<void> {
  await resetGoalProgressToAuto(id);
}

export async function reopenObjective(id: string): Promise<void> {
  await unarchiveObjective(id);
  await resetObjectiveProgressToAuto(id);
}

// ------------------------------------------------------------
// Historial de completados por Área
// ------------------------------------------------------------

export interface CompletedItem {
  kind: "project" | "objective";
  id: string;
  name: string;
  startedAt: string;
  finishedAt: string;
}

export async function fetchCompletedHistory(areaId: string): Promise<CompletedItem[]> {
  const [projects, objectives] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, created_at, archived_at")
      .eq("area_id", areaId)
      .not("archived_at", "is", null)
      .gte("progress_pct", 100),
    supabase
      .from("objectives")
      .select("id, name, created_at, archived_at")
      .eq("area_id", areaId)
      .not("archived_at", "is", null)
      .gte("progress_pct", 100),
  ]);
  if (projects.error) throw projects.error;
  if (objectives.error) throw objectives.error;

  const items: CompletedItem[] = [
    ...(projects.data ?? []).map((p) => ({
      kind: "project" as const,
      id: p.id,
      name: p.name,
      startedAt: p.created_at,
      finishedAt: p.archived_at as string,
    })),
    ...(objectives.data ?? []).map((o) => ({
      kind: "objective" as const,
      id: o.id,
      name: o.name,
      startedAt: o.created_at,
      finishedAt: o.archived_at as string,
    })),
  ];
  return items.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}
