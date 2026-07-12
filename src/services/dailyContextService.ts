/**
 * ========================================================
 * Archivo: dailyContextService — Daily Context Engine
 *
 * Responsabilidad:
 * Construir un ÚNICO objeto estructurado (`DailyContext`) que
 * describa el estado del usuario "hoy". Este objeto será la
 * entrada de futuros consumidores (IA, Dashboard, Widgets,
 * Notificaciones, Integraciones) SIN que ninguno tenga que
 * volver a tocar la base de datos.
 *
 * Filosofía:
 * - No se envía la base entera al modelo: primero se destila
 *   un contexto denso y objetivo.
 * - Esta capa NO genera texto, NO redacta recomendaciones y
 *   NO llama a ningún LLM. Sólo produce datos.
 *
 * Arquitectura:
 * - Independiente de la interfaz.
 * - No depende de FOCO ni del Calendario: consulta Supabase
 *   directamente, con las mismas reglas de archivado que el
 *   resto de servicios (Subproyecto → Proyecto → Área activos).
 * - Reutilizable: `buildDailyContext()` es una función pura de
 *   "ahora" (`now`) sobre los datos leídos de la base.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

type JoinedTask = TaskRow & {
  subprojects:
    | {
        id: string;
        archived_at: string | null;
        projects:
          | {
              id: string;
              name: string;
              archived_at: string | null;
              areas:
                | {
                    id: string;
                    name: string;
                    archived_at: string | null;
                  }
                | null;
            }
          | null;
      }
    | null;
};

// ============================================================
// Tipos públicos del contexto
// ============================================================

export type AlertCode =
  | "schedule_conflict"
  | "overloaded_day"
  | "empty_day"
  | "stalled_project"
  | "overloaded_area"
  | "ancient_task";

export interface DailyContextAlert {
  code: AlertCode;
  /** Severidad objetiva 1..3 (1=info, 2=warn, 3=crit). */
  severity: 1 | 2 | 3;
  /**
   * Datos crudos y estructurados de la alerta. NO contiene
   * lenguaje natural: quien lo consuma decide cómo redactarlo.
   */
  data: Record<string, unknown>;
}

export interface CountByEntity {
  id: string;
  name: string;
  count: number;
}

export interface NextCalendarEvent {
  taskId: string;
  title: string;
  startsAt: string; // ISO
  /** Minutos desde `now` hasta `startsAt` (siempre > 0). */
  minutesUntil: number;
}

export interface DailyContextTasks {
  totalActive: number;
  overdue: number;
  today: number;
  tomorrow: number;
  completedToday: number;
  completedThisWeek: number;
  createdToday: number;
  archivedToday: number;
  /** Pending sin `starts_at` y sin actividad reciente (proxy de "sin revisar"). */
  newUnreviewed: number;
  highPriority: number;
}

export interface DailyContextCalendar {
  nextEvent: NextCalendarEvent | null;
  /** Total de eventos programados hoy. */
  eventsToday: number;
}

export interface DailyContextProjects {
  activeCount: number;
  /** Proyectos activos sin actividad en tareas durante N días. */
  stalledDays: number;
  stalled: Array<{ id: string; name: string; daysInactive: number }>;
  tasksByProject: CountByEntity[];
}

export interface DailyContextAreas {
  activeCount: number;
  tasksByArea: CountByEntity[];
}

// ---------- Tipos del "plan del día" (determinista) ----------

export type PartOfDay = "morning" | "afternoon" | "night";
export type DayLoad = "light" | "moderate" | "high";
export type Priority = "high" | "medium" | "low";

export interface TodayEvent {
  taskId: string;
  title: string;
  startsAt: string; // ISO
  endsAt: string | null; // ISO
  minutesUntil: number; // negativo si ya empezó
  priority: Priority;
  ended: boolean;
}

export type RecommendationKind =
  | "event_imminent"
  | "task"
  | "ambiguous"
  | "night_review"
  | "empty";

export type RecommendationReasonCode =
  | "imminent_event"
  | "high_overdue"
  | "high_today"
  | "high_no_date"
  | "medium_overdue"
  | "medium_today"
  | "other_today"
  | "oldest_pending"
  | "multiple_high"
  | "night"
  | "empty_day";

export interface TodayPlan {
  timezone: string;
  localTime: string; // HH:MM
  partOfDay: PartOfDay;
  load: DayLoad;
  loadCounts: {
    events: number;
    today: number;
    overdue: number;
    highNoDate: number;
    total: number;
  };
  events: TodayEvent[];
  imminentEvent: TodayEvent | null;
  nextEvent: TodayEvent | null;
  areaSummary: { name: string; count: number } | null;
  recommendation: {
    kind: RecommendationKind;
    activity?: {
      taskId: string;
      title: string;
      priority: Priority;
      startsAt?: string;
      dueLabel?: "overdue" | "today" | "no_date";
    };
    reasonCode: RecommendationReasonCode;
    alternatives?: Array<{ taskId: string; title: string }>;
  };
}

export interface DailyContext {
  /** ISO de la fecha local considerada "hoy". */
  date: string;
  /** ISO exacto del instante en que se computó el contexto. */
  generatedAt: string;
  tasks: DailyContextTasks;
  calendar: DailyContextCalendar;
  projects: DailyContextProjects;
  areas: DailyContextAreas;
  alerts: DailyContextAlert[];
  /** Plan determinista del día. Alimenta directamente la pantalla "Tu Día". */
  today: TodayPlan;
}

// ============================================================
// Helpers de fecha (locales al huso del navegador/servidor)
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000;

/** Umbral (en días) para considerar un Proyecto "detenido". */
const STALLED_PROJECT_DAYS = 14;
/** Umbral (en días) para considerar una Tarea "muy antigua". */
const ANCIENT_TASK_DAYS = 30;
/** Nº de tareas programadas en un día a partir del cual se considera "sobrecargado". */
const OVERLOAD_DAY_THRESHOLD = 8;
/** Nº de tareas activas en un Área a partir del cual se considera "sobrecargada". */
const OVERLOAD_AREA_THRESHOLD = 20;
/** Umbral (en días) sin `updated_at` para "sin revisar". */
const UNREVIEWED_DAYS = 3;

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekLocal(d: Date): Date {
  const x = startOfLocalDay(d);
  const dow = x.getDay(); // 0=domingo
  const diff = dow === 0 ? 0 : 7 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeekLocal(d: Date): Date {
  const x = startOfLocalDay(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow; // Lunes como inicio
  x.setDate(x.getDate() + diff);
  return x;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// Detección de conflictos de horario
// ============================================================

interface ScheduledSlot {
  taskId: string;
  title: string;
  start: number;
  end: number;
}

function detectScheduleConflicts(
  slots: ScheduledSlot[],
): Array<{ a: string; b: string; titleA: string; titleB: string; overlapMin: number }> {
  const sorted = [...slots].sort((x, y) => x.start - y.start);
  const conflicts: Array<{
    a: string;
    b: string;
    titleA: string;
    titleB: string;
    overlapMin: number;
  }> = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].start >= sorted[i].end) break;
      const overlap = Math.min(sorted[i].end, sorted[j].end) - sorted[j].start;
      if (overlap > 0) {
        conflicts.push({
          a: sorted[i].taskId,
          b: sorted[j].taskId,
          titleA: sorted[i].title,
          titleB: sorted[j].title,
          overlapMin: Math.round(overlap / 60000),
        });
      }
    }
  }
  return conflicts;
}

// ============================================================
// Motor puro: recibe datos y `now`, devuelve el contexto
// ============================================================

// ============================================================
// Timezone-aware helpers (IANA)
// ============================================================

interface TzParts { y: number; m: number; d: number; H: number; M: number; }

function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function partsInTz(d: Date, tz: string): TzParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(d)) map[p.type] = p.value;
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    H: Number(map.hour === "24" ? "0" : map.hour),
    M: Number(map.minute),
  };
}

/** "YYYY-MM-DD" of `d` in tz. */
function tzDateKey(d: Date, tz: string): string {
  const p = partsInTz(d, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function partOfDayFromHour(h: number): PartOfDay {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 19) return "afternoon";
  return "night";
}

// ============================================================
// Motor puro: recibe datos y `now`, devuelve el contexto
// ============================================================

export interface DailyContextInput {
  now: Date;
  /** IANA timezone (perfil del usuario). Fallback: TZ del navegador. */
  timezone?: string;
  tasks: JoinedTask[];
  /** TODAS las tareas del usuario en ventana relevante (incluye archivadas hoy y completadas esta semana). */
  recentTasks: JoinedTask[];
  areas: AreaRow[];
  projects: ProjectRow[];
}

export function buildDailyContext(input: DailyContextInput): DailyContext {
  const { now, tasks, recentTasks, areas, projects } = input;
  const tz = input.timezone && input.timezone.trim() ? input.timezone : browserTz();

  const today = startOfLocalDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const dayAfterTomorrow = new Date(today.getTime() + 2 * DAY_MS);
  const weekStart = startOfWeekLocal(now);
  const weekEnd = endOfWeekLocal(now);

  // ---- Índices auxiliares ----
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const areaIdOfTask = (t: JoinedTask): string | null =>
    t.subprojects?.projects?.areas?.id ?? null;
  const projectIdOfTask = (t: JoinedTask): string | null =>
    t.subprojects?.projects?.id ?? null;

  // ---- Buckets de estado ----
  const activeTasks = tasks.filter((t) => !t.archived_at && t.status !== "completed");

  let overdue = 0;
  let todayCount = 0;
  let tomorrowCount = 0;
  let highPriority = 0;
  let newUnreviewed = 0;

  const eventsToday: ScheduledSlot[] = [];
  const futureEvents: ScheduledSlot[] = [];

  const tasksByArea = new Map<string, number>();
  const tasksByProject = new Map<string, number>();
  const unreviewedThreshold = now.getTime() - UNREVIEWED_DAYS * DAY_MS;

  for (const t of activeTasks) {
    if (t.priority === "high") highPriority++;

    const areaId = areaIdOfTask(t);
    if (areaId) tasksByArea.set(areaId, (tasksByArea.get(areaId) ?? 0) + 1);
    const projId = projectIdOfTask(t);
    if (projId) tasksByProject.set(projId, (tasksByProject.get(projId) ?? 0) + 1);

    const starts = t.starts_at ? new Date(t.starts_at) : null;
    if (starts) {
      const dayStart = startOfLocalDay(starts).getTime();
      if (dayStart < today.getTime()) overdue++;
      else if (dayStart === today.getTime()) todayCount++;
      else if (dayStart === tomorrow.getTime()) tomorrowCount++;

      const hasTime = starts.getHours() !== 0 || starts.getMinutes() !== 0;
      if (hasTime) {
        const durationMs = (t.estimated_duration_min ?? 60) * 60000;
        const slot: ScheduledSlot = {
          taskId: t.id,
          title: t.title,
          start: starts.getTime(),
          end: starts.getTime() + durationMs,
        };
        if (dayStart === today.getTime()) eventsToday.push(slot);
        if (starts.getTime() > now.getTime()) futureEvents.push(slot);
      }
    } else {
      // sin fecha
      const updatedMs = new Date(t.updated_at).getTime();
      if (updatedMs <= unreviewedThreshold) newUnreviewed++;
    }
  }

  // ---- Completadas / creadas / archivadas ----
  let completedToday = 0;
  let completedThisWeek = 0;
  let createdToday = 0;
  let archivedToday = 0;
  for (const t of recentTasks) {
    if (t.completed_at) {
      const ts = new Date(t.completed_at).getTime();
      if (ts >= today.getTime() && ts < tomorrow.getTime()) completedToday++;
      if (ts >= weekStart.getTime() && ts <= weekEnd.getTime()) completedThisWeek++;
    }
    const createdMs = new Date(t.created_at).getTime();
    if (createdMs >= today.getTime() && createdMs < tomorrow.getTime()) createdToday++;
    if (t.archived_at) {
      const ts = new Date(t.archived_at).getTime();
      if (ts >= today.getTime() && ts < tomorrow.getTime()) archivedToday++;
    }
  }

  // ---- Próximo evento del calendario ----
  futureEvents.sort((a, b) => a.start - b.start);
  const next = futureEvents[0] ?? null;
  const nextEvent: NextCalendarEvent | null = next
    ? {
        taskId: next.taskId,
        title: next.title,
        startsAt: new Date(next.start).toISOString(),
        minutesUntil: Math.max(1, Math.round((next.start - now.getTime()) / 60000)),
      }
    : null;

  // ---- Áreas ----
  const areasActive = areas.filter((a) => !a.archived_at);
  const tasksByAreaArr: CountByEntity[] = areasActive
    .map((a) => ({ id: a.id, name: a.name, count: tasksByArea.get(a.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // ---- Proyectos ----
  const projectsActive = projects.filter((p) => !p.archived_at);
  const tasksByProjectArr: CountByEntity[] = projectsActive
    .map((p) => ({ id: p.id, name: p.name, count: tasksByProject.get(p.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // Última actividad de tareas por Proyecto (updated_at más reciente sobre TODAS las tareas
  // que pertenecen al proyecto, incluidas completadas/archivadas en la ventana `recentTasks`).
  const lastActivityByProject = new Map<string, number>();
  for (const t of [...tasks, ...recentTasks]) {
    const pid = projectIdOfTask(t);
    if (!pid) continue;
    const ts = new Date(t.updated_at).getTime();
    const prev = lastActivityByProject.get(pid) ?? 0;
    if (ts > prev) lastActivityByProject.set(pid, ts);
  }

  const stalledThreshold = now.getTime() - STALLED_PROJECT_DAYS * DAY_MS;
  const stalled = projectsActive
    .map((p) => {
      const last = lastActivityByProject.get(p.id) ?? new Date(p.updated_at).getTime();
      return {
        id: p.id,
        name: p.name,
        daysInactive: Math.floor((now.getTime() - last) / DAY_MS),
        last,
      };
    })
    .filter((p) => p.last <= stalledThreshold)
    .map(({ id, name, daysInactive }) => ({ id, name, daysInactive }))
    .sort((a, b) => b.daysInactive - a.daysInactive);

  // ---- Alertas ----
  const alerts: DailyContextAlert[] = [];

  // Conflictos de horario en el día actual.
  const conflicts = detectScheduleConflicts(eventsToday);
  for (const c of conflicts) {
    alerts.push({
      code: "schedule_conflict",
      severity: 3,
      data: c,
    });
  }

  // Exceso de carga hoy.
  if (todayCount + eventsToday.length >= OVERLOAD_DAY_THRESHOLD) {
    alerts.push({
      code: "overloaded_day",
      severity: 2,
      data: { date: isoDate(today), scheduled: todayCount, timed: eventsToday.length },
    });
  }

  // Día vacío: sin tareas ni eventos programados hoy.
  if (todayCount === 0 && eventsToday.length === 0) {
    alerts.push({
      code: "empty_day",
      severity: 1,
      data: { date: isoDate(today) },
    });
  }

  // Proyectos completamente detenidos.
  for (const p of stalled) {
    alerts.push({
      code: "stalled_project",
      severity: p.daysInactive >= STALLED_PROJECT_DAYS * 2 ? 2 : 1,
      data: p,
    });
  }

  // Áreas sobrecargadas.
  for (const a of tasksByAreaArr) {
    if (a.count >= OVERLOAD_AREA_THRESHOLD) {
      alerts.push({
        code: "overloaded_area",
        severity: 2,
        data: { id: a.id, name: a.name, count: a.count },
      });
    }
  }

  // Tareas muy antiguas (activas sin cerrar hace mucho).
  const ancientThreshold = now.getTime() - ANCIENT_TASK_DAYS * DAY_MS;
  for (const t of activeTasks) {
    if (new Date(t.created_at).getTime() <= ancientThreshold) {
      alerts.push({
        code: "ancient_task",
        severity: 1,
        data: {
          taskId: t.id,
          title: t.title,
          ageDays: Math.floor((now.getTime() - new Date(t.created_at).getTime()) / DAY_MS),
          areaId: areaIdOfTask(t),
          projectId: projectIdOfTask(t),
        },
      });
    }
  }


  // ============================================================
  // Plan determinista del día (TodayPlan)
  //
  // Reglas obligatorias:
  //  - Excluye `completed`, `archived`, `waiting`.
  //  - Excluye Eventos ya terminados como acción inmediata.
  //  - Jerarquía: Eventos inminentes → Tareas alta vencida → alta hoy →
  //    alta sin fecha → media vencida → media hoy → otras hoy.
  //  - Carga se calcula solo con actividades relevantes.
  //  - Adaptación por hora local (tz IANA).
  // ============================================================
  const todayKey = tzDateKey(now, tz);
  const nowP = partsInTz(now, tz);
  const localTime = `${String(nowP.H).padStart(2, "0")}:${String(nowP.M).padStart(2, "0")}`;
  const partOfDay = partOfDayFromHour(nowP.H);

  const planEvents: TodayEvent[] = [];
  let tasksTodayCount = 0;
  let overduePlan = 0;
  let highNoDateCount = 0;
  const taskCandidates: Array<{ t: JoinedTask; tier: number }> = [];

  for (const t of activeTasks) {
    const isEvent = t.activity_type === "event";
    const isWaiting = t.status === "waiting";
    const starts = t.starts_at ? new Date(t.starts_at) : null;
    const startsKey = starts ? tzDateKey(starts, tz) : null;
    const isOverdueP = startsKey ? startsKey < todayKey : false;
    const isTodayP = startsKey === todayKey;

    if (isEvent) {
      if (isTodayP && starts) {
        const endsAt = t.ends_at ? new Date(t.ends_at) : null;
        const impliedEnd =
          endsAt?.getTime() ??
          starts.getTime() + (t.estimated_duration_min ?? 60) * 60000;
        const ended = impliedEnd <= now.getTime();
        planEvents.push({
          taskId: t.id,
          title: t.title,
          startsAt: starts.toISOString(),
          endsAt: endsAt ? endsAt.toISOString() : null,
          minutesUntil: Math.round((starts.getTime() - now.getTime()) / 60000),
          priority: (t.priority ?? "medium") as Priority,
          ended,
        });
      }
      continue;
    }
    if (isWaiting) continue;

    if (isTodayP) tasksTodayCount++;
    else if (isOverdueP) overduePlan++;
    else if (!starts && t.priority === "high") highNoDateCount++;

    const relevant = isTodayP || isOverdueP || (!starts && t.priority === "high");
    if (!relevant) continue;

    const p = (t.priority ?? "medium") as Priority;
    let tier = 99;
    if (p === "high" && isOverdueP) tier = 1;
    else if (p === "high" && isTodayP) tier = 2;
    else if (p === "high" && !starts) tier = 3;
    else if (p === "medium" && isOverdueP) tier = 4;
    else if (p === "medium" && isTodayP) tier = 5;
    else if (isTodayP) tier = 6;
    taskCandidates.push({ t, tier });
  }

  taskCandidates.sort(
    (a, b) =>
      a.tier - b.tier ||
      new Date(a.t.updated_at).getTime() - new Date(b.t.updated_at).getTime(),
  );

  planEvents.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcomingEvents = planEvents.filter((e) => !e.ended && e.minutesUntil > 0);
  const nextEventPlan = upcomingEvents[0] ?? null;
  const imminentEvent =
    nextEventPlan && nextEventPlan.minutesUntil <= 60 ? nextEventPlan : null;

  const activeEventCount = planEvents.filter((e) => !e.ended).length;
  const totalRelevant =
    activeEventCount + tasksTodayCount + overduePlan + highNoDateCount;
  const load: DayLoad =
    totalRelevant <= 2 ? "light" : totalRelevant <= 6 ? "moderate" : "high";

  const tierReason: Record<number, RecommendationReasonCode> = {
    1: "high_overdue",
    2: "high_today",
    3: "high_no_date",
    4: "medium_overdue",
    5: "medium_today",
    6: "other_today",
  };
  const tierDue: Record<number, "overdue" | "today" | "no_date"> = {
    1: "overdue",
    2: "today",
    3: "no_date",
    4: "overdue",
    5: "today",
    6: "today",
  };

  let recommendation: TodayPlan["recommendation"];
  if (partOfDay === "night") {
    if (imminentEvent) {
      recommendation = {
        kind: "event_imminent",
        activity: {
          taskId: imminentEvent.taskId,
          title: imminentEvent.title,
          priority: imminentEvent.priority,
          startsAt: imminentEvent.startsAt,
        },
        reasonCode: "imminent_event",
      };
    } else {
      recommendation = { kind: "night_review", reasonCode: "night" };
    }
  } else if (imminentEvent) {
    recommendation = {
      kind: "event_imminent",
      activity: {
        taskId: imminentEvent.taskId,
        title: imminentEvent.title,
        priority: imminentEvent.priority,
        startsAt: imminentEvent.startsAt,
      },
      reasonCode: "imminent_event",
    };
  } else if (taskCandidates.length === 0) {
    if (nextEventPlan) {
      recommendation = {
        kind: "event_imminent",
        activity: {
          taskId: nextEventPlan.taskId,
          title: nextEventPlan.title,
          priority: nextEventPlan.priority,
          startsAt: nextEventPlan.startsAt,
        },
        reasonCode: "imminent_event",
      };
    } else {
      recommendation = { kind: "empty", reasonCode: "empty_day" };
    }
  } else {
    const first = taskCandidates[0];
    const second = taskCandidates[1];
    if (second && first.tier === second.tier && first.tier <= 3) {
      recommendation = {
        kind: "ambiguous",
        reasonCode: "multiple_high",
        alternatives: taskCandidates
          .filter((c) => c.tier === first.tier)
          .slice(0, 3)
          .map((c) => ({ taskId: c.t.id, title: c.t.title })),
      };
    } else {
      recommendation = {
        kind: "task",
        activity: {
          taskId: first.t.id,
          title: first.t.title,
          priority: (first.t.priority ?? "medium") as Priority,
          startsAt: first.t.starts_at ?? undefined,
          dueLabel: tierDue[first.tier] ?? "today",
        },
        reasonCode: tierReason[first.tier] ?? "other_today",
      };
    }
  }

  const topArea = tasksByAreaArr[0];
  const todayPlan: TodayPlan = {
    timezone: tz,
    localTime,
    partOfDay,
    load,
    loadCounts: {
      events: activeEventCount,
      today: tasksTodayCount,
      overdue: overduePlan,
      highNoDate: highNoDateCount,
      total: totalRelevant,
    },
    events: planEvents,
    imminentEvent,
    nextEvent: nextEventPlan,
    areaSummary:
      topArea && topArea.count >= 2
        ? { name: topArea.name, count: topArea.count }
        : null,
    recommendation,
  };

  return {
    date: isoDate(today),
    generatedAt: now.toISOString(),
    tasks: {
      totalActive: activeTasks.length,
      overdue,
      today: todayCount,
      tomorrow: tomorrowCount,
      completedToday,
      completedThisWeek,
      createdToday,
      archivedToday,
      newUnreviewed,
      highPriority,
    },
    calendar: {
      nextEvent,
      eventsToday: eventsToday.length,
    },
    projects: {
      activeCount: projectsActive.length,
      stalledDays: STALLED_PROJECT_DAYS,
      stalled,
      tasksByProject: tasksByProjectArr,
    },
    areas: {
      activeCount: areasActive.length,
      tasksByArea: tasksByAreaArr,
    },
    alerts,
    today: todayPlan,
  } satisfies DailyContext;

  // Silenciar lint si el bundler poda las Maps.
  void areaById;
  void projectById;
}

// ============================================================
// Fetcher: obtiene todo lo necesario y llama al motor puro
// ============================================================

const JOIN_SELECT =
  "*, subprojects!inner(id, archived_at, projects!inner(id, name, archived_at, areas!inner(id, name, archived_at)))";

/**
 * Construye el contexto diario del usuario autenticado consultando
 * Supabase. Es la única función que llama a la red; el resto es puro.
 *
 * Consumidores previstos (posteriormente):
 * - Prompts de IA (`buildPrompt(context)`).
 * - Widgets/Dashboard/Notificaciones (renderizado directo).
 * - Integraciones externas vía server functions.
 */
export async function getDailyContext(
  now: Date = new Date(),
  timezone?: string,
): Promise<DailyContext> {
  const today = startOfLocalDay(now);
  const weekStart = startOfWeekLocal(now);
  const windowStart = new Date(
    Math.min(today.getTime(), weekStart.getTime()) - DAY_MS,
  ).toISOString();

  const [activeRes, recentRes, areasRes, projectsRes] = await Promise.all([
    // Tareas activas (no archivadas, no completadas) para métricas y alertas.
    supabase
      .from("tasks")
      .select(JOIN_SELECT)
      .is("archived_at", null)
      .is("subprojects.archived_at", null)
      .is("subprojects.projects.archived_at", null)
      .is("subprojects.projects.areas.archived_at", null)
      .neq("status", "completed"),
    // Tareas "recientes" (completadas/creadas/archivadas dentro de la ventana
    // semana-actual) para contadores derivados. Se piden separadas para no
    // inflar el payload principal.
    supabase
      .from("tasks")
      .select(JOIN_SELECT)
      .or(
        `completed_at.gte.${windowStart},created_at.gte.${windowStart},archived_at.gte.${windowStart}`,
      ),
    supabase.from("areas").select("*"),
    supabase.from("projects").select("*"),
  ]);

  if (activeRes.error) throw activeRes.error;
  if (recentRes.error) throw recentRes.error;
  if (areasRes.error) throw areasRes.error;
  if (projectsRes.error) throw projectsRes.error;

  return buildDailyContext({
    now,
    tasks: (activeRes.data ?? []) as unknown as JoinedTask[],
    recentTasks: (recentRes.data ?? []) as unknown as JoinedTask[],
    areas: (areasRes.data ?? []) as AreaRow[],
    projects: (projectsRes.data ?? []) as ProjectRow[],
  });
}
