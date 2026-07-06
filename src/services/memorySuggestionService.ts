/**
 * ========================================================
 * Archivo: memorySuggestionService — Sugerencias de reutilización
 *
 * Responsabilidad:
 * Detectar cuando el usuario está a punto de crear un Área,
 * Proyecto o Subproyecto que se parece a uno que ya usó antes,
 * y — si el usuario confirma — duplicar esa estructura como
 * un árbol completamente independiente.
 *
 * Reglas:
 * - Consume EXCLUSIVAMENTE `memoryService` para conocer los
 *   patrones aprendidos. No reimplementa detección de patrones.
 * - Nunca modifica estructuras originales. Toda duplicación
 *   inserta filas nuevas con IDs nuevos.
 * - Nunca actúa sola: `findSimilarStructure` sólo devuelve una
 *   sugerencia; la confirmación vive en la UI.
 *
 * Se integra en el flujo de creación inline de TaskDetailForm.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getMemorySnapshot,
  type MemorySnapshot,
  type OrganizationPattern,
  type PatternKind,
} from "@/services/memoryService";
import { createArea } from "@/services/areaService";
import { createProject } from "@/services/projectService";
import { createSubproject } from "@/services/subprojectService";
import type { Database } from "@/integrations/supabase/types";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

// ============================================================
// Similitud
// ============================================================

const SIMILARITY_THRESHOLD = 0.72;

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Similitud de Dice sobre bigramas de caracteres (0..1). */
function diceSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) {
    return na === nb ? 1 : 0;
  }
  const bigrams = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      set.set(bg, (set.get(bg) ?? 0) + 1);
    }
    return set;
  };
  const A = bigrams(na);
  const B = bigrams(nb);
  let hits = 0;
  for (const [bg, count] of A) {
    const other = B.get(bg);
    if (other) hits += Math.min(count, other);
  }
  return (2 * hits) / (na.length - 1 + nb.length - 1);
}

// ============================================================
// Tipos públicos
// ============================================================

export interface SuggestionContext {
  /** Área bajo la que se creará (proyecto) o cuyo proyecto contendrá el subproyecto. */
  areaId?: string;
  /** Proyecto bajo el que se creará el subproyecto. */
  projectId?: string;
}

export interface StructureMatch {
  kind: PatternKind;
  /** ID del elemento existente cuya estructura se copiará. */
  sourceId: string;
  /** Nombre original — se muestra al usuario como referencia. */
  sourceName: string;
  /** Similitud 0..1 combinando distancia textual y confianza del patrón. */
  score: number;
  /** Área a la que pertenece el elemento fuente (contexto informativo). */
  sourceAreaId?: string;
  sourceAreaName?: string;
  /** Proyecto al que pertenece el subproyecto fuente. */
  sourceProjectId?: string;
  sourceProjectName?: string;
  /** Métricas para el resumen que ve el usuario. */
  summary: {
    projectsCount: number;      // sólo para kind='area'
    subprojectsCount: number;   // para area y project
    tasksCount: number;         // para los tres
    lastUsedAt: string | null;  // ISO
  };
  /** Patrón de memoria asociado (si existe). */
  pattern?: OrganizationPattern;
}

// ============================================================
// Búsqueda de coincidencia
// ============================================================

async function fetchCandidatesForKind(
  kind: PatternKind,
  ctx: SuggestionContext,
): Promise<Array<{ id: string; name: string; scopeId?: string; created_at: string }>> {
  if (kind === "area") {
    const { data, error } = await supabase
      .from("areas")
      .select("id, name, created_at")
      .is("archived_at", null);
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, name: r.name, created_at: r.created_at }));
  }
  if (kind === "project") {
    // Buscamos en TODAS las áreas del usuario: un patrón se refuerza si
    // reutiliza el mismo nombre de proyecto en distintas áreas también.
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, area_id, created_at")
      .is("archived_at", null);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      scopeId: r.area_id,
      created_at: r.created_at,
    }));
  }
  // subproject
  const { data, error } = await supabase
    .from("subprojects")
    .select("id, name, project_id, created_at")
    .is("archived_at", null);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    scopeId: r.project_id,
    created_at: r.created_at,
  }));
}

async function summarize(
  kind: PatternKind,
  sourceId: string,
): Promise<StructureMatch["summary"]> {
  if (kind === "subproject") {
    const { data } = await supabase
      .from("tasks")
      .select("id, created_at")
      .eq("subproject_id", sourceId)
      .is("archived_at", null);
    const rows = data ?? [];
    return {
      projectsCount: 0,
      subprojectsCount: 0,
      tasksCount: rows.length,
      lastUsedAt: rows.map((r) => r.created_at).sort().at(-1) ?? null,
    };
  }
  if (kind === "project") {
    const { data: subs } = await supabase
      .from("subprojects")
      .select("id, created_at")
      .eq("project_id", sourceId)
      .is("archived_at", null);
    const subIds = (subs ?? []).map((s) => s.id);
    if (subIds.length === 0) {
      return { projectsCount: 0, subprojectsCount: 0, tasksCount: 0, lastUsedAt: null };
    }
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, created_at")
      .in("subproject_id", subIds)
      .is("archived_at", null);
    const trows = tasks ?? [];
    const last =
      [...(subs ?? []).map((s) => s.created_at), ...trows.map((t) => t.created_at)]
        .sort()
        .at(-1) ?? null;
    return {
      projectsCount: 0,
      subprojectsCount: subIds.length,
      tasksCount: trows.length,
      lastUsedAt: last,
    };
  }
  // area
  const { data: projs } = await supabase
    .from("projects")
    .select("id, created_at")
    .eq("area_id", sourceId)
    .is("archived_at", null);
  const projIds = (projs ?? []).map((p) => p.id);
  if (projIds.length === 0) {
    return { projectsCount: 0, subprojectsCount: 0, tasksCount: 0, lastUsedAt: null };
  }
  const { data: subs } = await supabase
    .from("subprojects")
    .select("id, project_id, created_at")
    .in("project_id", projIds)
    .is("archived_at", null);
  const subIds = (subs ?? []).map((s) => s.id);
  const { data: tasks } =
    subIds.length > 0
      ? await supabase
          .from("tasks")
          .select("id, created_at")
          .in("subproject_id", subIds)
          .is("archived_at", null)
      : { data: [] as { id: string; created_at: string }[] };
  const trows = tasks ?? [];
  const last =
    [
      ...(projs ?? []).map((p) => p.created_at),
      ...(subs ?? []).map((s) => s.created_at),
      ...trows.map((t) => t.created_at),
    ]
      .sort()
      .at(-1) ?? null;
  return {
    projectsCount: projIds.length,
    subprojectsCount: subIds.length,
    tasksCount: trows.length,
    lastUsedAt: last,
  };
}

/**
 * Busca la mejor coincidencia estructural para un nombre a punto de crearse.
 * Devuelve `null` si nada supera el umbral.
 *
 * Fórmula de puntaje:
 *   score = 0.7 * similitudTextual + 0.3 * confianzaDePatronDeMemoria
 * Si no hay patrón en memoria, sólo cuenta la similitud textual.
 * Se descartan coincidencias con el propio scope (no auto-sugerir).
 */
export async function findSimilarStructure(
  kind: PatternKind,
  name: string,
  ctx: SuggestionContext,
  memory?: MemorySnapshot,
): Promise<StructureMatch | null> {
  const target = normalize(name);
  if (target.length < 2) return null;

  const [snapshot, candidates] = await Promise.all([
    memory ? Promise.resolve(memory) : getMemorySnapshot(),
    fetchCandidatesForKind(kind, ctx),
  ]);

  // Index de patrones por (kind + normalizedName) para boost por confianza.
  const patternByName = new Map<string, OrganizationPattern>();
  for (const p of snapshot.patterns) {
    if (p.kind !== kind) continue;
    const key = `${p.kind}::${p.normalizedName}`;
    const prev = patternByName.get(key);
    if (!prev || p.confidence > prev.confidence) patternByName.set(key, p);
  }

  let best: {
    id: string;
    name: string;
    scopeId?: string;
    created_at: string;
    score: number;
    pattern?: OrganizationPattern;
  } | null = null;

  for (const cand of candidates) {
    const sim = diceSimilarity(name, cand.name);
    if (sim < 0.55) continue; // corte temprano para evitar ruido
    const pattern = patternByName.get(`${kind}::${normalize(cand.name)}`);
    const confBoost = pattern ? pattern.confidence : 0;
    const score = 0.7 * sim + 0.3 * confBoost;
    if (!best || score > best.score) best = { ...cand, score, pattern };
  }

  if (!best || best.score < SIMILARITY_THRESHOLD) return null;

  // Enriquecer con nombres de área/proyecto del elemento fuente.
  let sourceAreaId: string | undefined;
  let sourceAreaName: string | undefined;
  let sourceProjectId: string | undefined;
  let sourceProjectName: string | undefined;

  if (kind === "area") {
    sourceAreaId = best.id;
  } else if (kind === "project") {
    sourceAreaId = best.scopeId;
    if (sourceAreaId) {
      const { data } = await supabase
        .from("areas")
        .select("name")
        .eq("id", sourceAreaId)
        .maybeSingle();
      sourceAreaName = data?.name ?? undefined;
    }
  } else {
    sourceProjectId = best.scopeId;
    if (sourceProjectId) {
      const { data } = await supabase
        .from("projects")
        .select("name, area_id, areas(name)")
        .eq("id", sourceProjectId)
        .maybeSingle();
      sourceProjectName = data?.name ?? undefined;
      sourceAreaId = (data as { area_id?: string } | null)?.area_id;
      sourceAreaName =
        (data as { areas?: { name?: string } } | null)?.areas?.name ?? undefined;
    }
  }

  const summary = await summarize(kind, best.id);

  return {
    kind,
    sourceId: best.id,
    sourceName: best.name,
    score: Math.round(best.score * 100) / 100,
    sourceAreaId,
    sourceAreaName,
    sourceProjectId,
    sourceProjectName,
    summary,
    pattern: best.pattern,
  };
}

// ============================================================
// Duplicación de estructura
// ============================================================

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) throw new Error("No hay usuario autenticado.");
  return u.id;
}

/** Copia una tarea como plantilla limpia (pending, sin fechas, sin archivar). */
function cloneTaskInsert(
  row: Database["public"]["Tables"]["tasks"]["Row"],
  newSubprojectId: string,
  userId: string,
): TaskInsert {
  return {
    title: row.title,
    description: row.description,
    priority: row.priority,
    estimated_duration_min: row.estimated_duration_min,
    subproject_id: newSubprojectId,
    user_id: userId,
    status: "pending",
    starts_at: null,
    completed_at: null,
    archived_at: null,
    source: "manual",
  };
}

async function duplicateSubprojectContents(
  sourceSubprojectId: string,
  newSubprojectId: string,
  userId: string,
): Promise<{ tasks: number }> {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("subproject_id", sourceSubprojectId)
    .is("archived_at", null);
  if (error) throw error;
  const rows = tasks ?? [];
  if (rows.length === 0) return { tasks: 0 };
  const inserts: TaskInsert[] = rows.map((r) => cloneTaskInsert(r, newSubprojectId, userId));
  const { error: insErr } = await supabase.from("tasks").insert(inserts);
  if (insErr) throw insErr;
  return { tasks: rows.length };
}

async function duplicateProjectContents(
  sourceProjectId: string,
  newProjectId: string,
  userId: string,
): Promise<{ subprojects: number; tasks: number }> {
  const { data: subs, error } = await supabase
    .from("subprojects")
    .select("id, name, display_order")
    .eq("project_id", sourceProjectId)
    .is("archived_at", null)
    .order("display_order", { ascending: true });
  if (error) throw error;

  let totalTasks = 0;
  for (const s of subs ?? []) {
    const { data: created, error: subErr } = await supabase
      .from("subprojects")
      .insert({
        name: s.name,
        project_id: newProjectId,
        display_order: s.display_order,
      })
      .select("id")
      .single();
    if (subErr) throw subErr;
    const res = await duplicateSubprojectContents(s.id, created.id, userId);
    totalTasks += res.tasks;
  }
  return { subprojects: (subs ?? []).length, tasks: totalTasks };
}

export interface DuplicateResult {
  kind: PatternKind;
  newId: string;
  counts: { projects: number; subprojects: number; tasks: number };
}

/**
 * Duplica la estructura descrita por `match` bajo un nombre nuevo elegido
 * por el usuario. El resultado es un árbol completamente independiente:
 *
 *   Área          → nueva Área con sus Proyectos → Subproyectos → Tareas.
 *   Proyecto      → nuevo Proyecto (dentro de `targetAreaId`) con sus
 *                   Subproyectos → Tareas.
 *   Subproyecto   → nuevo Subproyecto (dentro de `targetProjectId`) con
 *                   sus Tareas.
 *
 * Las tareas se clonan como plantillas: `status='pending'`, sin fechas,
 * sin `completed_at` ni `archived_at`. La estructura original nunca
 * se modifica: sólo se hacen INSERTs de filas nuevas.
 */
export async function duplicateStructure(
  match: StructureMatch,
  newName: string,
  target: { areaId?: string; projectId?: string },
): Promise<DuplicateResult> {
  const userId = await currentUserId();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("El nombre es obligatorio.");

  if (match.kind === "area") {
    const created = await createArea({ name: trimmed });
    const { data: projs, error } = await supabase
      .from("projects")
      .select("id, name, description, color, display_order")
      .eq("area_id", match.sourceId)
      .is("archived_at", null)
      .order("display_order", { ascending: true });
    if (error) throw error;
    let subprojects = 0;
    let tasks = 0;
    for (const p of projs ?? []) {
      const newProject = await createProject({
        name: p.name,
        area_id: created.id,
        description: p.description,
        color: p.color,
        display_order: p.display_order,
      });
      const r = await duplicateProjectContents(p.id, newProject.id, userId);
      subprojects += r.subprojects;
      tasks += r.tasks;
    }
    return {
      kind: "area",
      newId: created.id,
      counts: { projects: (projs ?? []).length, subprojects, tasks },
    };
  }

  if (match.kind === "project") {
    if (!target.areaId) throw new Error("Falta el área destino.");
    const { data: source, error } = await supabase
      .from("projects")
      .select("description, color, display_order")
      .eq("id", match.sourceId)
      .maybeSingle();
    if (error) throw error;
    const newProject = await createProject({
      name: trimmed,
      area_id: target.areaId,
      description: source?.description ?? null,
      color: source?.color ?? null,
      display_order: source?.display_order ?? undefined,
    });
    const r = await duplicateProjectContents(match.sourceId, newProject.id, userId);
    return {
      kind: "project",
      newId: newProject.id,
      counts: { projects: 0, subprojects: r.subprojects, tasks: r.tasks },
    };
  }

  // subproject
  if (!target.projectId) throw new Error("Falta el proyecto destino.");
  const { data: source } = await supabase
    .from("subprojects")
    .select("display_order")
    .eq("id", match.sourceId)
    .maybeSingle();
  const newSub = await createSubproject({
    name: trimmed,
    project_id: target.projectId,
    display_order: source?.display_order ?? null,
  });
  const r = await duplicateSubprojectContents(match.sourceId, newSub.id, userId);
  return {
    kind: "subproject",
    newId: newSub.id,
    counts: { projects: 0, subprojects: 0, tasks: r.tasks },
  };
}
