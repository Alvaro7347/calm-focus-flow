/**
 * ahaService — "Primera descarga mental" (Aha Moment).
 *
 * Reglas de privacidad:
 *  • Analytics NUNCA recibe títulos/descripciones/textos del usuario.
 *  • Todo lo persistido en `tasks` es funcionalidad propia (título real).
 *  • activation_cycles solo guarda métricas agregadas y escalas 1–5.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchAreas, createArea } from "@/services/areaService";
import { fetchProjects, createProject } from "@/services/projectService";
import { fetchSubprojects, createSubproject } from "@/services/subprojectService";
import { createTask, type TaskPriority } from "@/services/taskService";
import { trackEvent } from "@/services/analyticsService";
import { ANALYTICS_EVENTS } from "@/services/analyticsEvents";

// ---------- Tipos ----------

export type CapturedItemType = "tarea" | "idea" | "preocupacion" | "recordatorio";
export type CapturedItemPriority = "baja" | "media" | "alta";
export type CapturedItemWhen = "hoy" | "esta_semana" | "mas_adelante" | "esperando";

export interface CapturedItem {
  /** ID temporal para React keys y confirmación. NO se persiste. */
  id: string;
  title: string;
  type: CapturedItemType;
  priority: CapturedItemPriority;
  when: CapturedItemWhen;
  /** Si el usuario lo confirma para crear como tarea. */
  confirmed: boolean;
}

export interface NextStep {
  id: string;
  /** Puntero al CapturedItem que lo originó (por si el usuario descarta). */
  sourceItemId: string;
  title: string;
  edited: boolean;
  discarded: boolean;
}

export interface AhaFlowSummary {
  dumpedItemsCount: number;
  createdTasksCount: number;
  confirmedNextStepsCount: number;
  mentalLoadBefore: number | null;
  mentalLoadAfter: number | null;
  mentalLoadDelta: number | null;
}

// ---------- LocalStorage: primera vez ----------

function completedKey(userId: string) {
  return `calmapp.aha.completed.${userId}`;
}

export function hasCompletedFirstAha(userId: string | null | undefined): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(completedKey(userId)) === "true";
  } catch {
    return false;
  }
}

export function markFirstAhaCompleted(userId: string | null | undefined): void {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(completedKey(userId), "true");
  } catch {
    /* noop */
  }
}

// ---------- Parseo de descarga ----------

const RE_HOY = /\b(hoy|urgent[eé]|manana|mañana|ya)\b/i;
const RE_ESPERANDO = /\b(esperar|esperando|respuesta|dependo|pendiente de|aguardar)\b/i;
const RE_MAS_ADELANTE = /\b(algun d[ií]a|alg[uú]n dia|idea|quiz[aá]s|tal vez|futuro|mas adelante|más adelante)\b/i;
const RE_PREOCUPACION = /\b(me preocupa|no s[eé] si|tengo miedo|angustia|preocupa)\b/i;
const RE_IDEA = /\b(idea|se me ocurre|podr[ií]a|explorar)\b/i;
const RE_RECORDATORIO = /\b(recordar|no olvidar|acordarme|acuerdo|acordar)\b/i;
const RE_PRIO_ALTA = /\b(urgent[eé]|importante|clave|no puede fallar|antes de|deadline)\b/i;
const RE_PRIO_BAJA = /\b(cuando pueda|sin apuro|baja prioridad|no urgente)\b/i;

function classifyLine(raw: string): Omit<CapturedItem, "id"> {
  const text = raw.trim();
  const lower = text.toLowerCase();

  let when: CapturedItemWhen = "esta_semana";
  if (RE_ESPERANDO.test(lower)) when = "esperando";
  else if (RE_MAS_ADELANTE.test(lower)) when = "mas_adelante";
  else if (RE_HOY.test(lower)) when = "hoy";

  let type: CapturedItemType = "tarea";
  if (RE_PREOCUPACION.test(lower)) type = "preocupacion";
  else if (RE_RECORDATORIO.test(lower)) type = "recordatorio";
  else if (RE_IDEA.test(lower) && when !== "hoy") type = "idea";

  let priority: CapturedItemPriority = "media";
  if (RE_PRIO_ALTA.test(lower) || when === "hoy") priority = "alta";
  else if (RE_PRIO_BAJA.test(lower) || when === "mas_adelante") priority = "baja";

  return {
    title: text,
    type,
    priority,
    when,
    confirmed: type === "tarea" || type === "recordatorio",
  };
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function parseBrainDumpText(text: string): CapturedItem[] {
  if (!text) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-\*•·]+/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 60);
  return lines.map((l) => ({ id: randomId(), ...classifyLine(l) }));
}

// ---------- Próximos pasos ----------

const WHEN_WEIGHT: Record<CapturedItemWhen, number> = {
  hoy: 4,
  esta_semana: 3,
  esperando: 1,
  mas_adelante: 0,
};
const PRIO_WEIGHT: Record<CapturedItemPriority, number> = {
  alta: 3,
  media: 2,
  baja: 1,
};
const TYPE_WEIGHT: Record<CapturedItemType, number> = {
  tarea: 3,
  recordatorio: 2,
  preocupacion: 1,
  idea: 0,
};

export function suggestNextSteps(items: CapturedItem[]): NextStep[] {
  const pool = items.filter((i) => i.confirmed && i.when !== "mas_adelante");
  const scored = pool
    .map((i) => ({
      item: i,
      score: WHEN_WEIGHT[i.when] * 10 + PRIO_WEIGHT[i.priority] * 3 + TYPE_WEIGHT[i.type],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map((s) => ({
    id: randomId(),
    sourceItemId: s.item.id,
    title: s.item.title,
    edited: false,
    discarded: false,
  }));
}

// ---------- Bandeja de entrada (Área/Proyecto/Subproyecto por defecto) ----------

const INBOX_AREA_NAME = "Bandeja de entrada";
const INBOX_PROJECT_NAME = "General";
const INBOX_SUBPROJECT_NAME = "Descarga mental";

async function ensureInboxSubprojectId(): Promise<string> {
  // 1) Área
  const areas = await fetchAreas(false);
  let area = areas.find((a) => a.name === INBOX_AREA_NAME);
  if (!area) area = await createArea({ name: INBOX_AREA_NAME });

  // 2) Proyecto
  const projects = await fetchProjects(area.id, false);
  let project = projects.find((p) => p.name === INBOX_PROJECT_NAME);
  if (!project) project = await createProject({ name: INBOX_PROJECT_NAME, area_id: area.id });

  // 3) Subproyecto
  const subs = await fetchSubprojects(project.id, false);
  let sub = subs.find((s) => s.name === INBOX_SUBPROJECT_NAME);
  if (!sub) sub = await createSubproject({ name: INBOX_SUBPROJECT_NAME, project_id: project.id });

  return sub.id;
}

function mapPriority(p: CapturedItemPriority): TaskPriority {
  return p === "alta" ? "high" : p === "baja" ? "low" : "medium";
}

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? 0 : 7 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString();
}

/**
 * Crea las tareas confirmadas. Devuelve la cantidad creada.
 * No persiste ítems descartados ni no confirmados.
 */
export async function createTasksFromConfirmedItems(
  items: CapturedItem[],
): Promise<{ createdCount: number; taskIds: string[] }> {
  const confirmed = items.filter((i) => i.confirmed);
  if (confirmed.length === 0) return { createdCount: 0, taskIds: [] };

  const subprojectId = await ensureInboxSubprojectId();
  const ids: string[] = [];

  for (const item of confirmed) {
    const starts_at =
      item.when === "hoy"
        ? todayIso()
        : item.when === "esta_semana"
          ? endOfWeekIso()
          : null;
    const status = item.when === "esperando" ? "waiting" : "pending";
    try {
      const row = await createTask({
        subproject_id: subprojectId,
        title: item.title.slice(0, 200),
        priority: mapPriority(item.priority),
        status,
        source: "manual",
        starts_at,
      });
      ids.push(row.id);
      // Analytics: sin título ni descripción.
      trackEvent(ANALYTICS_EVENTS.TASK_CREATED, {
        source: "aha_flow",
        has_due_date: !!starts_at,
        has_project: false,
        has_subproject: false,
        has_area: false,
        priority: item.priority,
      });
    } catch {
      // no romper el flujo si una tarea falla
    }
  }
  return { createdCount: ids.length, taskIds: ids };
}

// ---------- activation_cycles ----------

export async function startActivationCycle(): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return null;
    const { data, error } = await supabase
      .from("activation_cycles")
      .insert({ user_id: userId, cycle_type: "aha_first_brain_dump", status: "started" })
      .select("id")
      .single();
    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function completeActivationCycle(
  cycleId: string | null,
  payload: {
    dumpedItemsCount: number;
    reviewedItemsCount: number;
    createdTasksCount: number;
    nextStepsCount: number;
    confirmedNextStepsCount: number;
    mentalLoadBefore: number | null;
    mentalLoadAfter: number | null;
  },
): Promise<void> {
  if (!cycleId) return;
  const delta =
    payload.mentalLoadBefore != null && payload.mentalLoadAfter != null
      ? payload.mentalLoadBefore - payload.mentalLoadAfter
      : null;
  try {
    await supabase
      .from("activation_cycles")
      .update({
        completed_at: new Date().toISOString(),
        status: "completed",
        dumped_items_count: payload.dumpedItemsCount,
        reviewed_items_count: payload.reviewedItemsCount,
        created_tasks_count: payload.createdTasksCount,
        next_steps_count: payload.nextStepsCount,
        confirmed_next_steps_count: payload.confirmedNextStepsCount,
        mental_load_before: payload.mentalLoadBefore,
        mental_load_after: payload.mentalLoadAfter,
        mental_load_delta: delta,
      })
      .eq("id", cycleId);
  } catch {
    /* noop */
  }
}

export async function abandonActivationCycle(
  cycleId: string | null,
  step: string,
): Promise<void> {
  trackEvent(ANALYTICS_EVENTS.AHA_FLOW_ABANDONED, { step, source: "aha_flow" });
  if (!cycleId) return;
  try {
    await supabase
      .from("activation_cycles")
      .update({ status: "abandoned", completed_at: new Date().toISOString() })
      .eq("id", cycleId);
  } catch {
    /* noop */
  }
}
