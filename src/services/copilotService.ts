/**
 * ========================================================
 * Archivo: copilotService — Copiloto reflexivo
 *
 * OBSERVAR → MOSTRAR EVIDENCIA → PREGUNTAR.
 *
 * - Detecta patrones con reglas y umbrales explícitos sobre datos
 *   existentes (tasks + activity_log). Sin IA: textos fijos, sin
 *   diagnósticos ni interpretaciones.
 * - Sin evidencia suficiente, no devuelve nada.
 * - Ocasional: máximo una reflexión por día y el mismo patrón no
 *   se repite antes de 7 días.
 * - Las respuestas (texto libre) se guardan SOLO en este
 *   dispositivo (localStorage). Nunca se envían a la IA, a la
 *   analítica ni a Supabase.
 *
 * Patrones:
 *  1. Reprogramada:   3+ reprogramaciones en 14 días (activity_log).
 *  2. Pendiente:      fecha pasada hace 7+ días, o prioridad alta
 *                     sin fecha hace 21+ días.
 *  3. Actividad vs importante: 8+ acciones nuevas esta semana y
 *                     un proyecto con tareas de prioridad alta y
 *                     10+ días sin movimiento.
 *  4. Contraste de áreas (3 semanas): un área con 5+ completadas y
 *                     otra con 0–1 completadas y 3+ pendientes con
 *                     fecha pasada.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_DAYS = 7;
const MAX_ENTRIES = 60;

export type ReflectionKind = "rescheduled" | "lingering" | "activity" | "areas";

export interface Reflection {
  id: string;
  /** Clave del patrón concreto (para el enfriamiento de 7 días). */
  key: string;
  kind: ReflectionKind;
  /** Dato observable. */
  evidence: string;
  /** Pregunta abierta. */
  question: string;
  shownAt: string;
  answer?: string;
  answeredAt?: string;
  dismissed?: boolean;
}

type Candidate = Pick<Reflection, "key" | "kind" | "evidence" | "question">;

// ============================================================
// Almacenamiento local
// ============================================================

const STORE_KEY = "calmapp.copilot.v1";

function readStore(): Reflection[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Reflection[]) : [];
  } catch {
    return [];
  }
}

function writeStore(entries: Reflection[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Sin almacenamiento: la reflexión se muestra pero no se guarda.
  }
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function saveReflectionAnswer(id: string, answer: string): void {
  const entries = readStore();
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  e.answer = answer.trim();
  e.answeredAt = new Date().toISOString();
  writeStore(entries);
}

export function dismissReflection(id: string): void {
  const entries = readStore();
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  e.dismissed = true;
  writeStore(entries);
}

/** Reflexiones mostradas en un rango (para el Ritual semanal). */
export function getReflectionsBetween(from: Date, to: Date): Reflection[] {
  return readStore().filter((e) => {
    const t = new Date(e.shownAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
}

// ============================================================
// Reflexión del día
// ============================================================

/**
 * Devuelve la reflexión de hoy, si corresponde:
 * - Si ya hubo una hoy y sigue abierta (sin responder ni descartar),
 *   la misma. Si ya se respondió o descartó, ninguna.
 * - Si no hubo, detecta un patrón nuevo (respetando el enfriamiento).
 */
export async function getTodayReflection(now: Date = new Date()): Promise<Reflection | null> {
  const entries = readStore();
  const today = localDay(now);
  const todays = entries.find((e) => localDay(new Date(e.shownAt)) === today);
  if (todays) return todays.answer || todays.dismissed ? null : todays;

  const coolingKeys = new Set(
    entries
      .filter((e) => now.getTime() - new Date(e.shownAt).getTime() < COOLDOWN_DAYS * DAY_MS)
      .map((e) => e.key),
  );

  const candidates = await detectCandidates(now);
  const pick = candidates.find((c) => !coolingKeys.has(c.key));
  if (!pick) return null;

  const reflection: Reflection = {
    ...pick,
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    shownAt: now.toISOString(),
  };
  writeStore([...entries, reflection]);
  return reflection;
}

// ============================================================
// Detección
// ============================================================

type OpenTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  activity_type: string;
  starts_at: string | null;
  created_at: string;
  completed_at: string | null;
  area_id: string;
  areas: { name: string; archived_at: string | null } | null;
  subprojects: {
    archived_at: string | null;
    project_id: string;
    projects: { name: string; archived_at: string | null; created_at: string } | null;
  } | null;
};

type LogRow = {
  task_id: string;
  tasks: { title: string; status: string; archived_at: string | null } | null;
};

function isActive(t: OpenTask): boolean {
  if (t.areas?.archived_at) return false;
  if (t.subprojects && (t.subprojects.archived_at || t.subprojects.projects?.archived_at)) {
    return false;
  }
  return true;
}

/** Instante en ms (independiente del formato del texto ISO). */
function ts(iso: string): number {
  return new Date(iso).getTime();
}

function days(n: number): string {
  return `${n} ${n === 1 ? "día" : "días"}`;
}

function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

async function detectCandidates(now: Date): Promise<Candidate[]> {
  const since14 = new Date(now.getTime() - 14 * DAY_MS).toISOString();
  const since21 = new Date(now.getTime() - 21 * DAY_MS).toISOString();
  const since10 = new Date(now.getTime() - 10 * DAY_MS).toISOString();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = mondayOf(now).toISOString();

  const taskSelect =
    "id, title, status, priority, activity_type, starts_at, created_at, completed_at, area_id, areas(name, archived_at), subprojects(archived_at, project_id, projects(name, archived_at, created_at))";

  const [openRes, recentRes, logRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(taskSelect)
      .eq("activity_type", "task")
      .eq("status", "pending")
      .is("archived_at", null),
    supabase
      .from("tasks")
      .select(taskSelect)
      .eq("activity_type", "task")
      .is("archived_at", null)
      .or(`completed_at.gte.${since21},created_at.gte.${weekStart}`),
    supabase
      .from("activity_log")
      .select("task_id, tasks(title, status, archived_at)")
      .eq("action", "rescheduled")
      .gte("created_at", since14),
  ]);
  if (openRes.error || recentRes.error) return [];

  const open = ((openRes.data ?? []) as unknown as OpenTask[]).filter(isActive);
  const recent = ((recentRes.data ?? []) as unknown as OpenTask[]).filter(isActive);
  const logs = logRes.error ? [] : ((logRes.data ?? []) as unknown as LogRow[]);

  const out: Candidate[] = [];

  // ---------- 1. Reprogramada varias veces ----------
  const reschedCount = new Map<string, { n: number; title: string }>();
  for (const l of logs) {
    if (!l.tasks || l.tasks.archived_at || l.tasks.status === "completed") continue;
    const cur = reschedCount.get(l.task_id) ?? { n: 0, title: l.tasks.title };
    cur.n += 1;
    reschedCount.set(l.task_id, cur);
  }
  [...reschedCount.entries()]
    .filter(([, v]) => v.n >= 3)
    .sort((a, b) => b[1].n - a[1].n)
    .forEach(([taskId, v]) => {
      out.push({
        key: `rescheduled:${taskId}`,
        kind: "rescheduled",
        evidence: `"${v.title}" se reprogramó ${v.n} veces en los últimos 14 días.`,
        question:
          "Quizás no sea solamente un problema de tiempo. ¿Qué aparece en ti cuando piensas en hacerla?",
      });
    });

  // ---------- 2. Pendiente hace tiempo ----------
  const lingering = open
    .map((t) => {
      if (t.starts_at) {
        const start = new Date(t.starts_at);
        const d = Math.floor((startOfToday.getTime() - start.getTime()) / DAY_MS);
        return d >= 7 ? { t, d, dated: true } : null;
      }
      if (t.priority === "high") {
        const d = Math.floor((now.getTime() - new Date(t.created_at).getTime()) / DAY_MS);
        return d >= 21 ? { t, d, dated: false } : null;
      }
      return null;
    })
    .filter((x): x is { t: OpenTask; d: number; dated: boolean } => !!x)
    .sort((a, b) => b.d - a.d);
  for (const { t, d, dated } of lingering.slice(0, 5)) {
    out.push({
      key: `lingering:${t.id}`,
      kind: "lingering",
      evidence: dated
        ? `"${t.title}" sigue pendiente ${days(d)} después de su fecha.`
        : `"${t.title}" es importante y lleva ${days(d)} esperando, sin fecha.`,
      question: "¿Qué crees que está dificultando comenzarla?",
    });
  }

  // ---------- 3. Actividad nueva vs. lo importante ----------
  const createdThisWeek = recent.filter((t) => ts(t.created_at) >= ts(weekStart)).length;
  if (createdThisWeek >= 8) {
    const movedProjects = new Set(
      recent
        .filter((t) => t.completed_at && ts(t.completed_at) >= ts(since10) && t.subprojects)
        .map((t) => t.subprojects!.project_id),
    );
    const stalled = new Map<string, string>();
    for (const t of open) {
      const p = t.subprojects?.projects;
      if (!p || t.priority !== "high") continue;
      const pid = t.subprojects!.project_id;
      if (movedProjects.has(pid) || ts(p.created_at) > ts(since10)) continue;
      stalled.set(pid, p.name);
    }
    if (stalled.size > 0) {
      const names = [...stalled.values()];
      const extra = names.length > 1 ? ` y ${names.length - 1} más` : "";
      out.push({
        key: "activity:week",
        kind: "activity",
        evidence: `Esta semana agregaste ${createdThisWeek} acciones nuevas, mientras "${names[0]}"${extra} lleva más de 10 días sin movimiento y tiene tareas importantes pendientes.`,
        question: "¿Estamos agregando actividad sin mover lo importante?",
      });
    }
  }

  // ---------- 4. Contraste entre áreas ----------
  const completedByArea = new Map<string, { name: string; n: number }>();
  for (const t of recent) {
    if (t.status !== "completed" || !t.completed_at || ts(t.completed_at) < ts(since21)) continue;
    const cur = completedByArea.get(t.area_id) ?? { name: t.areas?.name ?? "", n: 0 };
    cur.n += 1;
    completedByArea.set(t.area_id, cur);
  }
  const overdueByArea = new Map<string, { name: string; n: number }>();
  for (const t of open) {
    if (!t.starts_at || new Date(t.starts_at).getTime() >= startOfToday.getTime()) continue;
    const cur = overdueByArea.get(t.area_id) ?? { name: t.areas?.name ?? "", n: 0 };
    cur.n += 1;
    overdueByArea.set(t.area_id, cur);
  }
  const strong = [...completedByArea.entries()]
    .filter(([, v]) => v.n >= 5)
    .sort((a, b) => b[1].n - a[1].n)[0];
  const weak = [...overdueByArea.entries()]
    .filter(([id, v]) => v.n >= 3 && (completedByArea.get(id)?.n ?? 0) <= 1 && id !== strong?.[0])
    .sort((a, b) => b[1].n - a[1].n)[0];
  if (strong && weak) {
    const weakDone = completedByArea.get(weak[0])?.n ?? 0;
    out.push({
      key: `areas:${strong[0]}:${weak[0]}`,
      kind: "areas",
      evidence: `En las últimas 3 semanas completaste ${strong[1].n} tareas de ${strong[1].name} y ${weakDone} de ${weak[1].name}, donde hay ${weak[1].n} pendientes con fecha pasada.`,
      question: "¿Hay algo diferente en cómo vives estos dos tipos de tareas?",
    });
  }

  return out;
}
