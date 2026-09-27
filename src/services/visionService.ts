/**
 * ========================================================
 * Archivo: visionService — Visión Activa
 *
 * Principio: no basta con saber QUÉ hacer; CalmApp recuerda
 * ocasionalmente PARA QUÉ, usando la visión que el propio
 * usuario escribió (sin inventar nada).
 *
 * Fuentes (ya existentes en Supabase, sólo lectura):
 *  - Proyecto:  projects.vision_text
 *  - Meta:      goals.vision_text → si no tiene, la del Objetivo
 *  - Hábito:    habits.desired_future_text → si no, reason_text
 *
 * Cuándo se muestra la visión (el vínculo "Esto mueve" es
 * siempre visible; la visión, no):
 *  - Detalle de tarea: la tarea lleva 7+ días pendiente, su
 *    fecha ya pasó, o su Proyecto/Meta lleva 10+ días sin
 *    tareas completadas.
 *  - Tu Día: como máximo una visión, de un Proyecto/Meta con
 *    tareas de prioridad alta pendientes y 10+ días sin
 *    movimiento.
 *
 * Anti-ruido (localStorage, por dispositivo):
 *  - La misma visión, máximo una vez al día.
 *  - Máximo 3 visiones al día en toda la app.
 *  (Dentro de una misma sesión, una visión ya mostrada puede
 *   volver a verse al reabrir la misma tarea.)
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { TaskWithHierarchy } from "@/services/taskService";

const STALE_TASK_DAYS = 7;
const STALLED_DAYS = 10;
const MAX_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type VisionKind = "project" | "goal" | "habit";

export interface VisionItem {
  /** Clave para el control de frecuencia: `project:<id>`, etc. */
  key: string;
  kind: VisionKind;
  id: string;
  /** Nombre de lo que la acción mueve (Proyecto, Meta u Hábito). */
  name: string;
  /** Texto de visión escrito por el usuario, o null. */
  vision: string | null;
  /** Rótulo sobrio para la visión. */
  visionLabel: string;
}

export interface TaskVisionContext extends VisionItem {
  /** true si el contexto justifica mostrar la visión (antes del límite diario). */
  meaningful: boolean;
}

// ============================================================
// Control de frecuencia
// ============================================================

const SHOWN_KEY = "calmapp.vision.shown.v1";
const shownThisSession = new Set<string>();

function todayLocal(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function readShown(): { date: string; keys: string[] } {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    const parsed = raw ? (JSON.parse(raw) as { date: string; keys: string[] }) : null;
    if (parsed && parsed.date === todayLocal()) return parsed;
  } catch {
    // Sin almacenamiento: se aplica sólo el control de la sesión.
  }
  return { date: todayLocal(), keys: [] };
}

/**
 * Decide si se puede mostrar la visión `key` ahora y, si es así,
 * la registra como mostrada. Llamar una sola vez por aparición.
 */
export function claimVisionSlot(key: string): boolean {
  if (shownThisSession.has(key)) return true;
  const state = readShown();
  if (state.keys.includes(key)) return false;
  if (state.keys.length >= MAX_PER_DAY) return false;
  state.keys.push(key);
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify(state));
  } catch {
    // Ignorar: sin persistencia, el límite dura la sesión.
  }
  shownThisSession.add(key);
  return true;
}

// ============================================================
// Detalle de tarea
// ============================================================

async function countCompletedSince(
  column: "subproject_id" | "goal_id",
  ids: string[],
  sinceIso: string,
): Promise<number> {
  if (ids.length === 0) return 0;
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in(column, ids)
    .eq("status", "completed")
    .gte("completed_at", sinceIso);
  return count ?? 0;
}

/**
 * Contexto de visión para una tarea abierta en su detalle.
 * Devuelve null si la tarea no está vinculada a Proyecto, Meta
 * ni Hábito (tarea directa de Área).
 */
export async function getTaskVisionContext(
  t: TaskWithHierarchy,
  now: Date = new Date(),
): Promise<TaskVisionContext | null> {
  const task = t.task;
  const isOpen = task.status === "pending" || task.status === "waiting";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskLingering =
    isOpen &&
    (new Date(task.created_at).getTime() <= now.getTime() - STALE_TASK_DAYS * DAY_MS ||
      (task.starts_at != null && new Date(task.starts_at).getTime() < startOfToday.getTime()));
  const stalledSince = new Date(now.getTime() - STALLED_DAYS * DAY_MS).toISOString();

  if (t.projectId) {
    const { data: p } = await supabase
      .from("projects")
      .select("id, name, vision_text, created_at")
      .eq("id", t.projectId)
      .maybeSingle();
    if (!p) return null;
    let stalled = false;
    if (isOpen && p.vision_text && new Date(p.created_at).toISOString() <= stalledSince) {
      const { data: subs } = await supabase.from("subprojects").select("id").eq("project_id", p.id);
      const recent = await countCompletedSince(
        "subproject_id",
        (subs ?? []).map((s) => s.id),
        stalledSince,
      );
      stalled = recent === 0;
    }
    const vision = p.vision_text?.trim() || null;
    return {
      key: `project:${p.id}`,
      kind: "project",
      id: p.id,
      name: p.name,
      vision,
      visionLabel: "Visión",
      meaningful: !!vision && (taskLingering || stalled),
    };
  }

  if (t.goalId) {
    const { data: g } = await supabase
      .from("goals")
      .select("id, name, vision_text, created_at, objectives(name, vision_text)")
      .eq("id", t.goalId)
      .maybeSingle();
    if (!g) return null;
    const objective = (g as unknown as { objectives: { vision_text: string | null } | null })
      .objectives;
    const vision = g.vision_text?.trim() || objective?.vision_text?.trim() || null;
    let stalled = false;
    if (isOpen && vision && new Date(g.created_at).toISOString() <= stalledSince) {
      stalled = (await countCompletedSince("goal_id", [g.id], stalledSince)) === 0;
    }
    return {
      key: `goal:${g.id}`,
      kind: "goal",
      id: g.id,
      name: g.name,
      vision,
      visionLabel: "Visión",
      meaningful: !!vision && (taskLingering || stalled),
    };
  }

  if (t.habitId) {
    const { data: h } = await supabase
      .from("habits")
      .select("id, name, desired_future_text, reason_text")
      .eq("id", t.habitId)
      .maybeSingle();
    if (!h) return null;
    const future = h.desired_future_text?.trim() || null;
    const reason = h.reason_text?.trim() || null;
    const vision = future ?? reason;
    return {
      key: `habit:${h.id}`,
      kind: "habit",
      id: h.id,
      name: h.name,
      vision,
      visionLabel: future ? "La versión que quiero ser" : "Por qué lo incorporo",
      meaningful: !!vision && taskLingering,
    };
  }

  return null;
}

// ============================================================
// Tu Día — una visión como máximo
// ============================================================

type ProjectRow = {
  id: string;
  name: string;
  vision_text: string | null;
  created_at: string;
  areas: { archived_at: string | null } | null;
};

type GoalRow = {
  id: string;
  name: string;
  vision_text: string | null;
  created_at: string;
  progress_mode: "auto" | "manual";
  progress_pct: number;
  objectives: {
    vision_text: string | null;
    archived_at: string | null;
    areas: { archived_at: string | null } | null;
  } | null;
};

type TaskLink = {
  goal_id: string | null;
  subprojects: { project_id: string; archived_at: string | null } | null;
};

/**
 * Elige, si corresponde, UNA visión para Tu Día: Proyecto o Meta
 * con visión escrita, tareas de prioridad alta pendientes y 10+
 * días sin tareas completadas. Rota entre candidatos día a día y
 * respeta el límite diario. Devuelve null si nada lo justifica.
 */
export async function getVisionDelDia(now: Date = new Date()): Promise<VisionItem | null> {
  const stalledSince = new Date(now.getTime() - STALLED_DAYS * DAY_MS).toISOString();

  const [projectsRes, goalsRes, highRes, recentRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, vision_text, created_at, areas(archived_at)")
      .is("archived_at", null),
    supabase
      .from("goals")
      .select(
        "id, name, vision_text, created_at, progress_mode, progress_pct, objectives(vision_text, archived_at, areas(archived_at))",
      )
      .is("archived_at", null),
    supabase
      .from("tasks")
      .select("goal_id, subprojects(project_id, archived_at)")
      .eq("activity_type", "task")
      .eq("status", "pending")
      .eq("priority", "high")
      .is("archived_at", null),
    supabase
      .from("tasks")
      .select("goal_id, subprojects(project_id, archived_at)")
      .eq("status", "completed")
      .gte("completed_at", stalledSince),
  ]);
  if (projectsRes.error || goalsRes.error || highRes.error || recentRes.error) return null;

  const highProjects = new Set<string>();
  const highGoals = new Set<string>();
  for (const t of (highRes.data ?? []) as unknown as TaskLink[]) {
    if (t.subprojects && !t.subprojects.archived_at) highProjects.add(t.subprojects.project_id);
    if (t.goal_id) highGoals.add(t.goal_id);
  }
  const recentProjects = new Set<string>();
  const recentGoals = new Set<string>();
  for (const t of (recentRes.data ?? []) as unknown as TaskLink[]) {
    if (t.subprojects) recentProjects.add(t.subprojects.project_id);
    if (t.goal_id) recentGoals.add(t.goal_id);
  }

  const candidates: VisionItem[] = [];
  for (const p of (projectsRes.data ?? []) as unknown as ProjectRow[]) {
    const vision = p.vision_text?.trim();
    if (!vision || p.areas?.archived_at) continue;
    if (p.created_at > stalledSince) continue;
    if (!highProjects.has(p.id) || recentProjects.has(p.id)) continue;
    candidates.push({
      key: `project:${p.id}`,
      kind: "project",
      id: p.id,
      name: p.name,
      vision,
      visionLabel: "Visión",
    });
  }
  for (const g of (goalsRes.data ?? []) as unknown as GoalRow[]) {
    if (!g.objectives || g.objectives.archived_at || g.objectives.areas?.archived_at) continue;
    if (g.progress_mode === "manual" && g.progress_pct >= 100) continue; // Meta completada
    const vision = g.vision_text?.trim() || g.objectives.vision_text?.trim();
    if (!vision) continue;
    if (g.created_at > stalledSince) continue;
    if (!highGoals.has(g.id) || recentGoals.has(g.id)) continue;
    candidates.push({
      key: `goal:${g.id}`,
      kind: "goal",
      id: g.id,
      name: g.name,
      vision,
      visionLabel: "Visión",
    });
  }
  if (candidates.length === 0) return null;

  // Rotación estable por día: cada día sugiere uno distinto.
  candidates.sort((a, b) => a.key.localeCompare(b.key));
  const dayIndex = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / DAY_MS,
  );
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[(dayIndex + i) % candidates.length];
    if (claimVisionSlot(c.key)) return c;
  }
  return null;
}
