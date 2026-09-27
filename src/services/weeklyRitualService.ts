/**
 * ========================================================
 * Archivo: weeklyRitualService — "Preparar mi semana"
 *
 * Responsabilidad:
 * Reunir y destilar, en un único objeto (`WeeklyRitualData`),
 * todo lo que necesita el Ritual Semanal:
 *   1. Cierre de la semana anterior.
 *   2. Lo importante (objetivos, metas, proyectos, hábitos, eventos).
 *   3. Omisiones: proyectos/metas con tareas de prioridad alta
 *      pendientes y NINGUNA acción programada en la nueva semana.
 *   4. Carga de la nueva semana (por día, conflictos, sin fecha).
 *   5. Resumen de cierre.
 *
 * Reutiliza:
 * - `fetchAreaTree()` (tableroService) para la estructura activa
 *   (Áreas → Proyectos → Etapas, Objetivos → Metas, Hábitos), con
 *   las mismas reglas de archivado en cascada que el Tablero.
 * - `getCurrentProfile()` para el día de inicio de semana.
 * - Misma regla de solapamiento semiabierto que `eventConflictService`.
 *
 * Sin cambios en Supabase: sólo lecturas. La decisión
 * "Esta semana no" se guarda en `localStorage` y expira sola.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchAreaTree, type AreaNode } from "@/services/tableroService";
import { getCurrentProfile } from "@/services/profileService";

// ============================================================
// Tipos públicos
// ============================================================

export interface RitualTask {
  id: string;
  title: string;
  status: "pending" | "completed" | "waiting";
  activityType: "task" | "event";
  priority: "high" | "medium" | "low";
  startsAt: string | null;
  endsAt: string | null;
  estimatedMin: number | null;
  completedAt: string | null;
  areaId: string;
  areaName: string;
  subprojectId: string | null;
  goalId: string | null;
  habitId: string | null;
  /** Proyecto resuelto vía Etapa (si la tarea cuelga de uno activo). */
  projectId: string | null;
  projectName: string | null;
  /** Nombre del vínculo principal para mostrar (Proyecto, Meta o Hábito). */
  linkLabel: string | null;
}

export interface RitualProject {
  id: string;
  name: string;
  areaId: string;
  areaName: string;
  areaSlug: string;
  slug: string;
  progressPct: number;
  vision: string | null;
  /** Etapas activas (para preseleccionar al agregar una acción). */
  subprojects: { id: string; name: string }[];
}

export interface RitualGoal {
  id: string;
  name: string;
  slug: string;
  objectiveId: string;
  objectiveName: string;
  objectiveSlug: string;
  areaId: string;
  areaName: string;
  areaSlug: string;
  progressPct: number;
  /** Visión de la Meta o, si no tiene, la de su Objetivo. */
  vision: string | null;
}

export interface RitualObjective {
  id: string;
  name: string;
  areaName: string;
  progressPct: number;
  goals: { id: string; name: string; progressPct: number }[];
}

export interface RitualHabit {
  id: string;
  name: string;
  areaName: string;
  reason: string | null;
  compliancePct: number;
}

export type OmissionKind = "project" | "goal";

export interface Omission {
  kind: OmissionKind;
  /** Clave estable para "Esta semana no": `project:<id>` o `goal:<id>`. */
  key: string;
  id: string;
  name: string;
  areaName: string;
  vision: string | null;
  highPendingCount: number;
  /** Destino para "Revisar" en el Tablero. */
  tablero: {
    area: string;
    proyecto?: string;
    objetivo?: string;
    meta?: string;
  };
  /** Valores por defecto para "Agregar acción". */
  createDefaults: TaskCreateDefaults;
}

export interface TaskCreateDefaults {
  areaId?: string;
  projectId?: string;
  subprojectId?: string;
  objectiveId?: string;
  goalId?: string;
  /** YYYY-MM-DD local. */
  fecha?: string;
}

export interface DayLoad {
  /** YYYY-MM-DD local. */
  date: string;
  label: string;
  items: RitualTask[];
  totalMin: number;
  highCount: number;
  isHeavy: boolean;
  isEmpty: boolean;
}

export interface EventConflictPair {
  a: RitualTask;
  b: RitualTask;
}

export interface WeeklyRitualData {
  /** Semana que se cierra. */
  prevStart: Date;
  prevEnd: Date;
  /** Semana que se prepara. */
  nextStart: Date;
  nextEnd: Date;
  weekKey: string;

  // Paso 1
  completedPrev: RitualTask[];
  pendingPrev: RitualTask[];
  overdueOlder: RitualTask[];
  projectsMoved: RitualProject[];
  projectsStill: RitualProject[];

  // Paso 2
  objectives: RitualObjective[];
  projects: RitualProject[];
  habits: RitualHabit[];
  eventsNext: RitualTask[];

  // Paso 3
  omissions: Omission[];

  // Paso 4
  days: DayLoad[];
  conflicts: EventConflictPair[];
  undated: RitualTask[];

  // Paso 5
  projectsWithActions: RitualProject[];
  goalsWithActions: RitualGoal[];
  mainTasks: RitualTask[];
}

// ============================================================
// Fechas (hora local del dispositivo, igual que el formulario)
// ============================================================

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Semana a preparar:
 * - Si hoy es el primer día de la semana → la semana que empieza hoy.
 * - Si no → la que empieza el próximo "primer día".
 * La semana a cerrar es la de los 7 días anteriores.
 */
export function computeRitualWeeks(now: Date, weekStartsOn: 0 | 1) {
  const today = startOfDay(now);
  const diff = (weekStartsOn - today.getDay() + 7) % 7;
  const nextStart = addDays(today, diff);
  const nextEnd = addDays(nextStart, 7);
  const prevStart = addDays(nextStart, -7);
  const prevEnd = nextStart;
  return { prevStart, prevEnd, nextStart, nextEnd, weekKey: toLocalDate(nextStart) };
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function dayLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

function inRange(iso: string | null, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

/** Minutos estimados de un ítem (evento: fin − inicio). */
export function itemMinutes(t: RitualTask): number {
  if (t.activityType === "event" && t.startsAt && t.endsAt) {
    const m = (new Date(t.endsAt).getTime() - new Date(t.startsAt).getTime()) / 60000;
    return m > 0 ? Math.round(m) : 0;
  }
  return t.estimatedMin ?? 0;
}

// ============================================================
// "Esta semana no" (localStorage, por semana)
// ============================================================

const SKIP_KEY = "calmapp.weeklyRitual.skip.v1";

type SkipStore = Record<string, string[]>;

function readSkips(): SkipStore {
  try {
    const raw = localStorage.getItem(SKIP_KEY);
    return raw ? (JSON.parse(raw) as SkipStore) : {};
  } catch {
    return {};
  }
}

function writeSkips(store: SkipStore): void {
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify(store));
  } catch {
    // Almacenamiento no disponible: la decisión dura sólo esta sesión.
  }
}

export function getSkippedKeys(weekKey: string): Set<string> {
  return new Set(readSkips()[weekKey] ?? []);
}

export function skipForWeek(weekKey: string, key: string): void {
  const store = readSkips();
  // Conservamos sólo la semana actual: las decisiones expiran solas.
  const current = new Set(store[weekKey] ?? []);
  current.add(key);
  writeSkips({ [weekKey]: [...current] });
}

export function unskipForWeek(weekKey: string, key: string): void {
  const store = readSkips();
  const current = (store[weekKey] ?? []).filter((k) => k !== key);
  writeSkips({ [weekKey]: current });
}

// ============================================================
// Carga de datos
// ============================================================

type RawTaskRow = {
  id: string;
  title: string;
  status: RitualTask["status"];
  activity_type: RitualTask["activityType"];
  priority: RitualTask["priority"];
  starts_at: string | null;
  ends_at: string | null;
  estimated_duration_min: number | null;
  completed_at: string | null;
  area_id: string;
  subproject_id: string | null;
  goal_id: string | null;
  habit_id: string | null;
};

/** Umbrales de carga (sobrios y explicables). */
const HEAVY_MINUTES = 6 * 60;
const HEAVY_ITEMS = 8;

export async function loadWeeklyRitual(now: Date = new Date()): Promise<WeeklyRitualData> {
  const profile = await getCurrentProfile().catch(() => null);
  const weekStartsOn: 0 | 1 = profile?.week_starts_on === 0 ? 0 : 1;
  const { prevStart, prevEnd, nextStart, nextEnd, weekKey } = computeRitualWeeks(now, weekStartsOn);

  const prevIso = prevStart.toISOString();
  const [tree, tasksRes] = await Promise.all([
    fetchAreaTree(),
    supabase
      .from("tasks")
      .select(
        "id, title, status, activity_type, priority, starts_at, ends_at, estimated_duration_min, completed_at, area_id, subproject_id, goal_id, habit_id",
      )
      .is("archived_at", null)
      // Pendientes de cualquier fecha + todo lo que toque las dos semanas.
      .or(`status.neq.completed,completed_at.gte.${prevIso},starts_at.gte.${prevIso}`),
  ]);
  if (tasksRes.error) throw tasksRes.error;

  return buildWeeklyRitual({
    tree,
    rows: (tasksRes.data ?? []) as RawTaskRow[],
    now,
    prevStart,
    prevEnd,
    nextStart,
    nextEnd,
    weekKey,
  });
}

// ============================================================
// Cálculo puro
// ============================================================

interface BuildInput {
  tree: AreaNode[];
  rows: RawTaskRow[];
  now: Date;
  prevStart: Date;
  prevEnd: Date;
  nextStart: Date;
  nextEnd: Date;
  weekKey: string;
}

export function buildWeeklyRitual(input: BuildInput): WeeklyRitualData {
  const { tree, rows, now, prevStart, prevEnd, nextStart, nextEnd, weekKey } = input;

  // ---------- Índices de la estructura activa ----------
  const areaById = new Map<string, AreaNode>();
  const projects: RitualProject[] = [];
  const projectBySubproject = new Map<string, RitualProject>();
  const goals: RitualGoal[] = [];
  const goalById = new Map<string, RitualGoal>();
  const objectives: RitualObjective[] = [];
  const habits: RitualHabit[] = [];
  const habitNameById = new Map<string, string>();

  for (const area of tree) {
    areaById.set(area.id, area);
    for (const p of area.proyectos) {
      const rp: RitualProject = {
        id: p.id,
        name: p.nombre,
        slug: p.slug,
        areaId: area.id,
        areaName: area.nombre,
        areaSlug: area.slug,
        progressPct: p.progresoPct,
        vision: p.visionTexto?.trim() || null,
        subprojects: p.subproyectos.map((s) => ({ id: s.id, name: s.nombre })),
      };
      projects.push(rp);
      for (const s of p.subproyectos) projectBySubproject.set(s.id, rp);
    }
    for (const o of area.objetivos) {
      objectives.push({
        id: o.id,
        name: o.nombre,
        areaName: area.nombre,
        progressPct: o.progresoPct,
        goals: o.metas.map((m) => ({ id: m.id, name: m.nombre, progressPct: m.progresoPct })),
      });
      for (const m of o.metas) {
        const rg: RitualGoal = {
          id: m.id,
          name: m.nombre,
          slug: m.slug,
          objectiveId: o.id,
          objectiveName: o.nombre,
          objectiveSlug: o.slug,
          areaId: area.id,
          areaName: area.nombre,
          areaSlug: area.slug,
          progressPct: m.progresoPct,
          vision: m.visionTexto?.trim() || o.visionTexto?.trim() || null,
        };
        goals.push(rg);
        goalById.set(m.id, rg);
      }
    }
    for (const h of area.habitos) {
      habits.push({
        id: h.id,
        name: h.nombre,
        areaName: area.nombre,
        reason: h.razon?.trim() || null,
        compliancePct: h.cumplimientoPct,
      });
      habitNameById.set(h.id, h.nombre);
    }
  }

  // ---------- Tareas: sólo las que cuelgan de estructura activa ----------
  const tasks: RitualTask[] = [];
  for (const r of rows) {
    const area = areaById.get(r.area_id);
    if (!area) continue; // Área archivada
    const project = r.subproject_id ? projectBySubproject.get(r.subproject_id) : undefined;
    if (r.subproject_id && !project) continue; // Etapa/Proyecto archivado
    const goal = r.goal_id ? goalById.get(r.goal_id) : undefined;
    if (r.goal_id && !goal) continue; // Meta/Objetivo archivado
    const habitName = r.habit_id ? habitNameById.get(r.habit_id) : undefined;
    if (r.habit_id && !habitName) continue; // Hábito archivado

    tasks.push({
      id: r.id,
      title: r.title,
      status: r.status,
      activityType: r.activity_type,
      priority: r.priority ?? "medium",
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      estimatedMin: r.estimated_duration_min,
      completedAt: r.completed_at,
      areaId: r.area_id,
      areaName: area.nombre,
      subprojectId: r.subproject_id,
      goalId: r.goal_id,
      habitId: r.habit_id,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      linkLabel: project?.name ?? goal?.name ?? habitName ?? null,
    });
  }

  const byStart = (a: RitualTask, b: RitualTask) =>
    (a.startsAt ?? "").localeCompare(b.startsAt ?? "");
  const priorityRank = { high: 0, medium: 1, low: 2 } as const;

  // ---------- Paso 1: cerrar la semana anterior ----------
  const onlyTasks = tasks.filter((t) => t.activityType === "task");
  const completedPrev = onlyTasks
    .filter((t) => t.status === "completed" && inRange(t.completedAt, prevStart, prevEnd))
    .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  const pendingPrev = onlyTasks
    .filter((t) => t.status !== "completed" && inRange(t.startsAt, prevStart, prevEnd))
    .sort(byStart);
  const overdueOlder = onlyTasks
    .filter(
      (t) =>
        t.status !== "completed" &&
        t.startsAt != null &&
        new Date(t.startsAt).getTime() < prevStart.getTime(),
    )
    .sort(byStart);

  // "Movimiento" de un proyecto en la semana que se cierra:
  //  a) una tarea completada en esa semana, o
  //  b) un evento que ocurrió en esa semana (p. ej. una clase).
  //     Los eventos no se marcan como completados: basta con que
  //     su inicio haya quedado en la semana y ya haya pasado.
  const heldUntil = new Date(Math.min(now.getTime(), prevEnd.getTime()));
  const heldEventsPrev = tasks.filter(
    (t) => t.activityType === "event" && inRange(t.startsAt, prevStart, heldUntil),
  );
  const movedProjectIds = new Set(
    [...completedPrev, ...heldEventsPrev]
      .map((t) => t.projectId)
      .filter((id): id is string => !!id),
  );
  const projectsMoved = projects.filter((p) => movedProjectIds.has(p.id));
  const projectsStill = projects.filter((p) => !movedProjectIds.has(p.id));

  // ---------- Nueva semana ----------
  const nextItems = tasks.filter((t) => inRange(t.startsAt, nextStart, nextEnd));
  const eventsNext = nextItems.filter((t) => t.activityType === "event").sort(byStart);

  // ---------- Paso 3: omisiones ----------
  const plannedProjectIds = new Set(
    nextItems.map((t) => t.projectId).filter((id): id is string => !!id),
  );
  const plannedGoalIds = new Set(nextItems.map((t) => t.goalId).filter((id): id is string => !!id));

  // Tareas de prioridad alta pendientes ("en espera" no cuenta).
  const highPending = onlyTasks.filter((t) => t.status === "pending" && t.priority === "high");
  const highByProject = new Map<string, number>();
  const highByGoal = new Map<string, number>();
  for (const t of highPending) {
    if (t.projectId) highByProject.set(t.projectId, (highByProject.get(t.projectId) ?? 0) + 1);
    if (t.goalId) highByGoal.set(t.goalId, (highByGoal.get(t.goalId) ?? 0) + 1);
  }

  const firstDay = toLocalDate(nextStart);
  const omissions: Omission[] = [];
  for (const p of projects) {
    const n = highByProject.get(p.id) ?? 0;
    if (n === 0 || plannedProjectIds.has(p.id)) continue;
    omissions.push({
      kind: "project",
      key: `project:${p.id}`,
      id: p.id,
      name: p.name,
      areaName: p.areaName,
      vision: p.vision,
      highPendingCount: n,
      tablero: { area: p.areaSlug, proyecto: p.slug },
      createDefaults: {
        areaId: p.areaId,
        projectId: p.id,
        subprojectId: p.subprojects.length === 1 ? p.subprojects[0].id : undefined,
        fecha: firstDay,
      },
    });
  }
  for (const g of goals) {
    const n = highByGoal.get(g.id) ?? 0;
    if (n === 0 || plannedGoalIds.has(g.id)) continue;
    omissions.push({
      kind: "goal",
      key: `goal:${g.id}`,
      id: g.id,
      name: g.name,
      areaName: g.areaName,
      vision: g.vision,
      highPendingCount: n,
      tablero: { area: g.areaSlug, objetivo: g.objectiveSlug, meta: g.slug },
      createDefaults: {
        areaId: g.areaId,
        objectiveId: g.objectiveId,
        goalId: g.id,
        fecha: firstDay,
      },
    });
  }

  // ---------- Paso 4: carga ----------
  const days: DayLoad[] = [];
  for (let i = 0; i < 7; i++) {
    const from = addDays(nextStart, i);
    const to = addDays(nextStart, i + 1);
    const items = nextItems
      .filter((t) => t.status !== "completed" && inRange(t.startsAt, from, to))
      .sort(byStart);
    const totalMin = items.reduce((acc, t) => acc + itemMinutes(t), 0);
    const highCount = items.filter((t) => t.priority === "high").length;
    days.push({
      date: toLocalDate(from),
      label: dayLabel(from),
      items,
      totalMin,
      highCount,
      isHeavy: totalMin >= HEAVY_MINUTES || items.length >= HEAVY_ITEMS,
      isEmpty: items.length === 0,
    });
  }

  // Conflictos: misma regla semiabierta que eventConflictService.
  const timedEvents = eventsNext.filter((e) => e.startsAt && e.endsAt);
  const conflicts: EventConflictPair[] = [];
  for (let i = 0; i < timedEvents.length; i++) {
    for (let j = i + 1; j < timedEvents.length; j++) {
      const a = timedEvents[i];
      const b = timedEvents[j];
      if (
        new Date(a.startsAt!).getTime() < new Date(b.endsAt!).getTime() &&
        new Date(a.endsAt!).getTime() > new Date(b.startsAt!).getTime()
      ) {
        conflicts.push({ a, b });
      }
    }
  }

  const undated = onlyTasks
    .filter((t) => t.status === "pending" && !t.startsAt)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  // ---------- Paso 5: resumen ----------
  const projectsWithActions = projects.filter((p) => plannedProjectIds.has(p.id));
  const goalsWithActions = goals.filter((g) => plannedGoalIds.has(g.id));
  const mainTasks = nextItems
    .filter((t) => t.activityType === "task" && t.status !== "completed" && t.priority === "high")
    .sort(byStart);

  return {
    prevStart,
    prevEnd,
    nextStart,
    nextEnd,
    weekKey,
    completedPrev,
    pendingPrev,
    overdueOlder,
    projectsMoved,
    projectsStill,
    objectives,
    projects,
    habits,
    eventsNext,
    omissions,
    days,
    conflicts,
    undated,
    projectsWithActions,
    goalsWithActions,
    mainTasks,
  };
}

// ============================================================
// Acciones (siempre vía taskService, nunca directo)
// ============================================================

/**
 * Nueva fecha de inicio al pasar una tarea a otro día, conservando
 * la hora si la tenía (00:00 local = "todo el día").
 */
export function moveToDayIso(startsAt: string | null, targetDate: string): string {
  const [y, m, d] = targetDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  if (startsAt) {
    const src = new Date(startsAt);
    if (!Number.isNaN(src.getTime())) {
      target.setHours(src.getHours(), src.getMinutes(), 0, 0);
    }
  }
  return target.toISOString();
}
