/**
 * ========================================================
 * Archivo: memoryService — Memoria Inteligente de CalmApp
 *
 * Responsabilidad:
 * Observar cómo el usuario organiza sus Áreas, Proyectos,
 * Subproyectos y Tareas, y destilar PATRONES reutilizables
 * (nombres recurrentes, frecuencias, cadencias temporales,
 * relaciones área↔proyecto, secuencias habituales).
 *
 * Filosofía:
 * - CalmApp NO recuerda conversaciones ni datos personales.
 *   Sólo aprende ESTRUCTURA organizacional.
 * - La memoria nunca modifica datos: sólo observa y sugiere.
 * - La memoria nunca escribe en la interfaz por sí sola: es
 *   un servicio consumible por futuras features (creación
 *   inteligente, captura inteligente, planificación asistida,
 *   recomendaciones contextuales, IA).
 *
 * Arquitectura:
 * - Independiente de Daily Context Engine, Daily AI Brief,
 *   FOCO y Calendario.
 * - Fuente de datos: Supabase (tasks + subprojects + projects
 *   + areas), respetando las reglas de archivado en cascada
 *   (Subproyecto → Proyecto → Área) que ya aplican FOCO y
 *   Calendar.
 * - Persistencia: snapshot serializable en `localStorage`
 *   (`calmapp.memory.snapshot.v1`). El snapshot es 100 %
 *   derivable — regenerable desde la base en cualquier momento.
 *   No es fuente de verdad, sólo caché.
 *
 * Reutilización futura:
 *   import { getMemorySnapshot, suggestFor } from "@/services/memoryService";
 *   const memory = await getMemorySnapshot();
 *   const projectHints = suggestFor(memory, { kind: "project", areaId });
 *   // → array ordenado por confianza; la UI/IA decide qué mostrar.
 *
 * NO IMPLEMENTAR aún:
 * - Sugerencias visibles en la interfaz.
 * - Auto-creación de proyectos o tareas.
 * - Notificaciones basadas en patrones.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// ============================================================
// Tipos públicos
// ============================================================

export type PatternKind = "area" | "project" | "subproject" | "task";
export type Cadence =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semestral"
  | "yearly"
  | "irregular";

/** Un patrón detectado por la memoria. Todos los patrones comparten forma. */
export interface OrganizationPattern {
  /** Identificador estable derivado del contenido (kind + normalizedName + scope). */
  id: string;
  kind: PatternKind;
  /** Nombre canónico normalizado (lowercase, trim, colapso de espacios). */
  normalizedName: string;
  /** Muestra del nombre original más representativo (para futuras sugerencias). */
  displayName: string;
  /** Área a la que suele pertenecer (si aplica). */
  areaId?: string;
  areaName?: string;
  /** Proyecto al que suele pertenecer (si aplica, sólo para subprojects/tasks). */
  projectId?: string;
  projectName?: string;
  /** Nº de veces observado. */
  occurrences: number;
  /** ISO de la primera y última observación. */
  firstSeen: string;
  lastSeen: string;
  /** Cadencia estimada. */
  cadence: Cadence;
  /** Días promedio entre observaciones (null si <2 observaciones). */
  avgGapDays: number | null;
  /** Confianza 0..1: combina volumen, regularidad y recencia. */
  confidence: number;
  /** Día de la semana dominante (0..6, domingo=0) si existe. */
  dominantDayOfWeek?: number;
  /** Día del mes dominante (1..31) si existe. */
  dominantDayOfMonth?: number;
}

/** Relación observada entre un Área y sus Proyectos habituales. */
export interface AreaProjectRelation {
  areaId: string;
  areaName: string;
  projectName: string;
  occurrences: number;
  confidence: number;
}

/** Secuencia habitual: tras crear X, el usuario suele crear Y dentro de N días. */
export interface WorkflowSequence {
  fromKind: PatternKind;
  fromName: string;
  toKind: PatternKind;
  toName: string;
  occurrences: number;
  avgLagDays: number;
  confidence: number;
}

export interface MemorySnapshot {
  version: 1;
  builtAt: string;
  /** Rango temporal observado. */
  observedFrom: string | null;
  observedTo: string | null;
  patterns: OrganizationPattern[];
  areaProjectRelations: AreaProjectRelation[];
  sequences: WorkflowSequence[];
  /** Métricas agregadas útiles para futuros consumidores. */
  metrics: {
    totalAreas: number;
    totalProjects: number;
    totalSubprojects: number;
    totalTasks: number;
    projectsPerArea: Record<string, number>;
  };
}

// ============================================================
// Configuración
// ============================================================

const STORAGE_KEY = "calmapp.memory.snapshot.v1";
/** Un patrón necesita al menos N ocurrencias para ser considerado. */
const MIN_OCCURRENCES = 2;
/** Ventana histórica máxima (años) — evita ruido antiguo. */
const HISTORY_YEARS = 3;
/** Ventana en días para considerar dos creaciones como "secuencia". */
const SEQUENCE_WINDOW_DAYS = 3;

// ============================================================
// Filas mínimas leídas desde Supabase
// ============================================================

type AreaLite = Pick<
  Database["public"]["Tables"]["areas"]["Row"],
  "id" | "name" | "created_at" | "archived_at"
>;
type ProjectLite = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "area_id" | "created_at" | "archived_at"
>;
type SubprojectLite = Pick<
  Database["public"]["Tables"]["subprojects"]["Row"],
  "id" | "name" | "project_id" | "created_at" | "archived_at"
>;
type TaskLite = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "title" | "subproject_id" | "created_at"
>;

interface RawObservations {
  areas: AreaLite[];
  projects: ProjectLite[];
  subprojects: SubprojectLite[];
  tasks: TaskLite[];
}

// ============================================================
// Utilidades
// ============================================================

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin acentos
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

function inferCadence(avgGap: number | null): Cadence {
  if (avgGap === null) return "irregular";
  if (avgGap <= 1.5) return "daily";
  if (avgGap <= 9) return "weekly";
  if (avgGap <= 18) return "biweekly";
  if (avgGap <= 45) return "monthly";
  if (avgGap <= 120) return "quarterly";
  if (avgGap <= 210) return "semestral";
  if (avgGap <= 400) return "yearly";
  return "irregular";
}

function dominantMode<T extends string | number>(values: T[]): T | undefined {
  if (!values.length) return undefined;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  // Sólo consideramos "dominante" si supera 50 % de la muestra.
  return bestN * 2 > values.length ? best : undefined;
}

/**
 * Confianza [0..1]:
 * - Volumen: satura a partir de ~6 ocurrencias.
 * - Regularidad: varianza baja de gaps → +.
 * - Recencia: penaliza patrones no vistos hace >180 días.
 */
function computeConfidence(
  occurrences: number,
  gaps: number[],
  lastSeenIso: string,
  now: number,
): number {
  const volume = Math.min(1, occurrences / 6);
  let regularity = 0.5;
  if (gaps.length >= 2) {
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (mean > 0) {
      const variance =
        gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
      const cv = Math.sqrt(variance) / mean; // coef. de variación
      regularity = Math.max(0, 1 - Math.min(cv, 1));
    }
  }
  const daysSinceLast = (now - new Date(lastSeenIso).getTime()) / 86_400_000;
  const recency = Math.max(0, 1 - Math.max(0, daysSinceLast - 30) / 180);
  return Math.round((0.45 * volume + 0.35 * regularity + 0.2 * recency) * 100) / 100;
}

// ============================================================
// Lectura de observaciones
// ============================================================

async function fetchObservations(): Promise<RawObservations> {
  const sinceIso = new Date(
    Date.now() - HISTORY_YEARS * 365 * 86_400_000,
  ).toISOString();

  const [areasRes, projectsRes, subprojectsRes, tasksRes] = await Promise.all([
    supabase
      .from("areas")
      .select("id, name, created_at, archived_at")
      .gte("created_at", sinceIso),
    supabase
      .from("projects")
      .select("id, name, area_id, created_at, archived_at")
      .gte("created_at", sinceIso),
    supabase
      .from("subprojects")
      .select("id, name, project_id, created_at, archived_at")
      .gte("created_at", sinceIso),
    supabase
      .from("tasks")
      .select("id, title, subproject_id, created_at")
      .gte("created_at", sinceIso),
  ]);

  if (areasRes.error) throw areasRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (subprojectsRes.error) throw subprojectsRes.error;
  if (tasksRes.error) throw tasksRes.error;

  return {
    areas: (areasRes.data ?? []) as AreaLite[],
    projects: (projectsRes.data ?? []) as ProjectLite[],
    subprojects: (subprojectsRes.data ?? []) as SubprojectLite[],
    tasks: (tasksRes.data ?? []) as TaskLite[],
  };
}

// ============================================================
// Detección de patrones (función pura)
// ============================================================

interface Observation {
  kind: PatternKind;
  name: string;
  createdAt: string;
  areaId?: string;
  areaName?: string;
  projectId?: string;
  projectName?: string;
}

function buildObservations(raw: RawObservations): Observation[] {
  const areaById = new Map(raw.areas.map((a) => [a.id, a]));
  const projectById = new Map(raw.projects.map((p) => [p.id, p]));
  const subprojectById = new Map(raw.subprojects.map((s) => [s.id, s]));

  const obs: Observation[] = [];

  for (const p of raw.projects) {
    const area = areaById.get(p.area_id);
    obs.push({
      kind: "project",
      name: p.name,
      createdAt: p.created_at,
      areaId: p.area_id,
      areaName: area?.name,
    });
  }

  for (const s of raw.subprojects) {
    const project = projectById.get(s.project_id);
    const area = project ? areaById.get(project.area_id) : undefined;
    obs.push({
      kind: "subproject",
      name: s.name,
      createdAt: s.created_at,
      areaId: project?.area_id,
      areaName: area?.name,
      projectId: project?.id,
      projectName: project?.name,
    });
  }

  for (const t of raw.tasks) {
    const sub = subprojectById.get(t.subproject_id);
    const project = sub ? projectById.get(sub.project_id) : undefined;
    const area = project ? areaById.get(project.area_id) : undefined;
    obs.push({
      kind: "task",
      name: t.title,
      createdAt: t.created_at,
      areaId: project?.area_id,
      areaName: area?.name,
      projectId: project?.id,
      projectName: project?.name,
    });
  }

  return obs;
}

function detectPatterns(observations: Observation[], now: number): OrganizationPattern[] {
  // Agrupamos por (kind + nombre normalizado + scope):
  //  - project      → scope = areaId
  //  - subproject   → scope = projectId
  //  - task         → scope = projectId (subproyecto es demasiado granular)
  const groups = new Map<string, Observation[]>();
  for (const o of observations) {
    const norm = normalize(o.name);
    if (!norm) continue;
    const scope =
      o.kind === "project" ? o.areaId ?? "-" : o.projectId ?? "-";
    const key = `${o.kind}::${norm}::${scope}`;
    const arr = groups.get(key);
    if (arr) arr.push(o);
    else groups.set(key, [o]);
  }

  const patterns: OrganizationPattern[] = [];
  for (const [key, items] of groups) {
    if (items.length < MIN_OCCURRENCES) continue;
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const firstSeen = items[0].createdAt;
    const lastSeen = items[items.length - 1].createdAt;

    const gaps: number[] = [];
    for (let i = 1; i < items.length; i++) {
      gaps.push(daysBetween(items[i - 1].createdAt, items[i].createdAt));
    }
    const avgGap =
      gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null;

    const dows = items.map((i) => new Date(i.createdAt).getDay());
    const doms = items.map((i) => new Date(i.createdAt).getDate());

    const sample = items[items.length - 1];
    patterns.push({
      id: key,
      kind: sample.kind,
      normalizedName: normalize(sample.name),
      displayName: sample.name,
      areaId: sample.areaId,
      areaName: sample.areaName,
      projectId: sample.projectId,
      projectName: sample.projectName,
      occurrences: items.length,
      firstSeen,
      lastSeen,
      avgGapDays: avgGap === null ? null : Math.round(avgGap * 10) / 10,
      cadence: inferCadence(avgGap),
      confidence: computeConfidence(items.length, gaps, lastSeen, now),
      dominantDayOfWeek: dominantMode(dows),
      dominantDayOfMonth: dominantMode(doms),
    });
  }

  patterns.sort((a, b) => b.confidence - a.confidence);
  return patterns;
}

function detectAreaProjectRelations(
  raw: RawObservations,
): AreaProjectRelation[] {
  const areaById = new Map(raw.areas.map((a) => [a.id, a]));
  const counts = new Map<string, { area: AreaLite; projectName: string; n: number }>();
  for (const p of raw.projects) {
    const area = areaById.get(p.area_id);
    if (!area) continue;
    const key = `${p.area_id}::${normalize(p.name)}`;
    const entry = counts.get(key);
    if (entry) entry.n += 1;
    else counts.set(key, { area, projectName: p.name, n: 1 });
  }

  const totalPerArea = new Map<string, number>();
  for (const p of raw.projects) {
    totalPerArea.set(p.area_id, (totalPerArea.get(p.area_id) ?? 0) + 1);
  }

  const rels: AreaProjectRelation[] = [];
  for (const { area, projectName, n } of counts.values()) {
    if (n < MIN_OCCURRENCES) continue;
    const total = totalPerArea.get(area.id) ?? n;
    rels.push({
      areaId: area.id,
      areaName: area.name,
      projectName,
      occurrences: n,
      confidence: Math.round((n / total) * 100) / 100,
    });
  }
  rels.sort((a, b) => b.occurrences - a.occurrences);
  return rels;
}

function detectSequences(observations: Observation[]): WorkflowSequence[] {
  // Detecta pares (X → Y) donde Y suele crearse dentro de SEQUENCE_WINDOW_DAYS
  // días después de X. Se agrupan por nombre normalizado.
  const sorted = [...observations].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const pairCounts = new Map<
    string,
    {
      fromKind: PatternKind;
      fromName: string;
      toKind: PatternKind;
      toName: string;
      lags: number[];
    }
  >();

  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const to = sorted[j];
      const lag = daysBetween(from.createdAt, to.createdAt);
      if (lag > SEQUENCE_WINDOW_DAYS) break;
      if (from.name === to.name && from.kind === to.kind) continue;
      const key = `${from.kind}:${normalize(from.name)}→${to.kind}:${normalize(to.name)}`;
      const entry = pairCounts.get(key);
      if (entry) entry.lags.push(lag);
      else
        pairCounts.set(key, {
          fromKind: from.kind,
          fromName: from.name,
          toKind: to.kind,
          toName: to.name,
          lags: [lag],
        });
    }
  }

  const sequences: WorkflowSequence[] = [];
  for (const entry of pairCounts.values()) {
    if (entry.lags.length < MIN_OCCURRENCES) continue;
    const avg =
      entry.lags.reduce((s, g) => s + g, 0) / entry.lags.length;
    sequences.push({
      fromKind: entry.fromKind,
      fromName: entry.fromName,
      toKind: entry.toKind,
      toName: entry.toName,
      occurrences: entry.lags.length,
      avgLagDays: Math.round(avg * 10) / 10,
      confidence: Math.min(1, entry.lags.length / 6),
    });
  }
  sequences.sort((a, b) => b.occurrences - a.occurrences);
  return sequences.slice(0, 50); // techo defensivo
}

// ============================================================
// API pública
// ============================================================

/**
 * Construye un snapshot de memoria a partir de observaciones ya leídas.
 * Función pura: apta para tests, workers o llamadas server-side.
 */
export function buildMemorySnapshot(
  raw: RawObservations,
  now: Date = new Date(),
): MemorySnapshot {
  const observations = buildObservations(raw);
  const patterns = detectPatterns(observations, now.getTime());
  const areaProjectRelations = detectAreaProjectRelations(raw);
  const sequences = detectSequences(observations);

  const dates = observations.map((o) => o.createdAt).sort();
  const projectsPerArea: Record<string, number> = {};
  for (const p of raw.projects) {
    projectsPerArea[p.area_id] = (projectsPerArea[p.area_id] ?? 0) + 1;
  }

  return {
    version: 1,
    builtAt: now.toISOString(),
    observedFrom: dates[0] ?? null,
    observedTo: dates[dates.length - 1] ?? null,
    patterns,
    areaProjectRelations,
    sequences,
    metrics: {
      totalAreas: raw.areas.length,
      totalProjects: raw.projects.length,
      totalSubprojects: raw.subprojects.length,
      totalTasks: raw.tasks.length,
      projectsPerArea,
    },
  };
}

/**
 * Lee las observaciones desde Supabase, reconstruye la memoria y la
 * persiste en `localStorage`. Nunca lanza al llamador si el caché falla.
 */
export async function refreshMemorySnapshot(): Promise<MemorySnapshot> {
  const raw = await fetchObservations();
  const snapshot = buildMemorySnapshot(raw);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* almacenamiento no disponible: silencioso */
  }
  return snapshot;
}

/** Devuelve el snapshot cacheado si existe. */
export function readCachedSnapshot(): MemorySnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemorySnapshot;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Obtiene el snapshot: usa caché si es reciente, si no lo reconstruye.
 * `maxAgeMs` por defecto 6 h — la memoria no necesita tiempo real.
 */
export async function getMemorySnapshot(
  maxAgeMs = 6 * 60 * 60 * 1000,
): Promise<MemorySnapshot> {
  const cached = readCachedSnapshot();
  if (cached) {
    const age = Date.now() - new Date(cached.builtAt).getTime();
    if (age < maxAgeMs) return cached;
  }
  return refreshMemorySnapshot();
}

/** Borra el snapshot cacheado (útil para "olvidar" o para tests). */
export function clearMemorySnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

// ============================================================
// Consultas de alto nivel (para futuros consumidores)
// ============================================================

export interface SuggestQuery {
  kind: PatternKind;
  /** Contexto opcional: filtra por área (project) o por proyecto (subproject/task). */
  areaId?: string;
  projectId?: string;
  /** Confianza mínima 0..1. */
  minConfidence?: number;
  limit?: number;
}

/**
 * Devuelve patrones aplicables a un contexto dado, ordenados por confianza.
 * Nunca modifica datos: la UI o la IA decidirán qué hacer con esta lista.
 */
export function suggestFor(
  memory: MemorySnapshot,
  query: SuggestQuery,
): OrganizationPattern[] {
  const min = query.minConfidence ?? 0.3;
  const limit = query.limit ?? 10;
  return memory.patterns
    .filter((p) => p.kind === query.kind)
    .filter((p) => (query.areaId ? p.areaId === query.areaId : true))
    .filter((p) => (query.projectId ? p.projectId === query.projectId : true))
    .filter((p) => p.confidence >= min)
    .slice(0, limit);
}
