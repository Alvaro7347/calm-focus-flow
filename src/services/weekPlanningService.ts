/**
 * ========================================================
 * Archivo: weekPlanningService — Tiempo de la semana y repetición
 *
 * Dos piezas del Ritual "Preparar mi semana":
 *
 * 1) loadTimeDistribution(from, to)
 *    Cómo se distribuyó el tiempo en un rango (la semana que se
 *    cierra), por Área → Dimensión, por Proyecto y por etiqueta.
 *      - Tarea completada en el rango: tiempo real; si no tiene, la
 *        duración estimada; si tampoco, cuenta como "sin tiempo".
 *      - Evento que ocurrió en el rango: su horario (fin − inicio).
 *      - "No la hice" / "No fui" no cuenta.
 *    Incluye lo de proyectos ya completados o archivados: ese tiempo
 *    sí ocurrió (el resto del Ritual sólo mira lo activo).
 *    Base reutilizable para el futuro presupuesto de tiempo.
 *
 * 2) repeatInNextWeek(ids)
 *    Copia actividades a la semana siguiente (mismo día y hora + 7),
 *    con su vínculo, Dimensión, duración, prioridad, etiquetas y
 *    recordatorio. Las copias nacen pendientes. Cada copia es
 *    independiente: si una falla (p. ej. choque de horario), las
 *    demás siguen.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import { createTask, type CreateTaskInput, type TaskRow } from "@/services/taskService";
import { fetchTaskTagIds, setTaskTags } from "@/services/tagService";
import { getTaskReminderOffset, setTaskReminder } from "@/services/reminderService";
import { parseEventConflictError } from "@/services/eventConflictService";

// ============================================================
// 1) Distribución del tiempo
// ============================================================

export interface DimensionTime {
  /** null = "Sin dimensión". */
  name: string | null;
  min: number;
}

export interface AreaTime {
  id: string;
  name: string;
  color: string | null;
  min: number;
  dimensions: DimensionTime[];
}

export interface NamedTime {
  name: string;
  min: number;
  /** Para proyectos: el Área a la que pertenecen. */
  detail?: string;
}

export interface TimeDistribution {
  totalMin: number;
  /** Actividades realizadas que no tienen ningún tiempo registrado. */
  withoutTime: number;
  areas: AreaTime[];
  projects: NamedTime[];
  tags: NamedTime[];
}

type DistRow = {
  id: string;
  activity_type: "task" | "event";
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  estimated_duration_min: number | null;
  actual_duration_min: number | null;
  dimension_id: string | null;
  area_id: string;
  areas: { name: string; color: string | null } | null;
  subprojects: {
    projects: { id: string; name: string; dimension_id: string | null } | null;
  } | null;
  goals: { objectives: { dimension_id: string | null } | null } | null;
  habits: { dimension_id: string | null } | null;
};

function minutesOf(r: DistRow): number {
  if (r.activity_type === "event") {
    if (!r.starts_at || !r.ends_at) return 0;
    const m = (new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / 60000;
    return m > 0 ? Math.round(m) : 0;
  }
  return r.actual_duration_min ?? r.estimated_duration_min ?? 0;
}

export async function loadTimeDistribution(from: Date, to: Date): Promise<TimeDistribution> {
  const fromIso = from.toISOString();
  // Un evento cuenta sólo si ya ocurrió.
  const heldUntilIso = new Date(Math.min(Date.now(), to.getTime())).toISOString();
  const toIso = to.toISOString();

  const select =
    "id, activity_type, status, starts_at, ends_at, estimated_duration_min, actual_duration_min, dimension_id, area_id, areas(name, color), subprojects(projects(id, name, dimension_id)), goals(objectives(dimension_id)), habits(dimension_id)";

  const PAGE = 1000;
  const rows: DistRow[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from("tasks")
      .select(select)
      .is("archived_at", null)
      .or(
        `and(activity_type.eq.task,status.eq.completed,completed_at.gte.${fromIso},completed_at.lt.${toIso}),and(activity_type.eq.event,status.neq.not_done,starts_at.gte.${fromIso},starts_at.lt.${heldUntilIso})`,
      )
      .order("id", { ascending: true })
      .range(start, start + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as DistRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const [dimsRes, tagsRes, linksRes] = await Promise.all([
    supabase.from("dimensions").select("id, name"),
    supabase.from("tags").select("id, name"),
    rows.length > 0
      ? supabase
          .from("task_tags")
          .select("task_id, tag_id")
          .in(
            "task_id",
            rows.map((r) => r.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  const dimName = new Map<string, string>(
    (dimsRes.data ?? []).map((d) => [d.id as string, d.name as string]),
  );
  const tagName = new Map<string, string>(
    (tagsRes.data ?? []).map((t) => [t.id as string, t.name as string]),
  );
  const tagsByTask = new Map<string, string[]>();
  for (const l of (linksRes.data ?? []) as { task_id: string; tag_id: string }[]) {
    tagsByTask.set(l.task_id, [...(tagsByTask.get(l.task_id) ?? []), l.tag_id]);
  }

  const areaMap = new Map<string, AreaTime & { dimMap: Map<string, number> }>();
  const projMap = new Map<string, NamedTime>();
  const tagMap = new Map<string, number>();
  let totalMin = 0;
  let withoutTime = 0;

  for (const r of rows) {
    const min = minutesOf(r);
    if (min === 0) {
      withoutTime++;
      continue;
    }
    totalMin += min;

    const project = r.subprojects?.projects ?? null;
    const dimId =
      r.dimension_id ??
      project?.dimension_id ??
      r.goals?.objectives?.dimension_id ??
      r.habits?.dimension_id ??
      null;
    const dimKey = dimId ? (dimName.get(dimId) ?? "") : "";

    const area =
      areaMap.get(r.area_id) ??
      (() => {
        const a = {
          id: r.area_id,
          name: r.areas?.name ?? "Área",
          color: r.areas?.color ?? null,
          min: 0,
          dimensions: [],
          dimMap: new Map<string, number>(),
        };
        areaMap.set(r.area_id, a);
        return a;
      })();
    area.min += min;
    area.dimMap.set(dimKey, (area.dimMap.get(dimKey) ?? 0) + min);

    if (project) {
      const p = projMap.get(project.id) ?? { name: project.name, min: 0, detail: area.name };
      p.min += min;
      projMap.set(project.id, p);
    }

    for (const tagId of tagsByTask.get(r.id) ?? []) {
      tagMap.set(tagId, (tagMap.get(tagId) ?? 0) + min);
    }
  }

  const byMin = (a: { min: number }, b: { min: number }) => b.min - a.min;
  const areas: AreaTime[] = [...areaMap.values()]
    .map(({ dimMap, ...a }) => ({
      ...a,
      dimensions: [...dimMap.entries()]
        .map(([name, min]) => ({ name: name || null, min }))
        .sort(byMin),
    }))
    .sort(byMin);

  return {
    totalMin,
    withoutTime,
    areas,
    projects: [...projMap.values()].sort(byMin),
    tags: [...tagMap.entries()]
      .filter(([id]) => tagName.has(id))
      .map(([id, min]) => ({ name: tagName.get(id)!, min }))
      .sort(byMin),
  };
}

// ============================================================
// 2) Repetir en la nueva semana
// ============================================================

export interface RepeatResult {
  copied: number;
  failed: { title: string; reason: string }[];
}

/** Misma hora local, `days` días después (respeta cambios de horario). */
function shiftDays(iso: string | null, days: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function repeatInNextWeek(ids: string[], days = 7): Promise<RepeatResult> {
  const result: RepeatResult = { copied: 0, failed: [] };
  if (ids.length === 0) return result;

  const { data, error } = await supabase.from("tasks").select("*").in("id", ids);
  if (error) throw error;
  const rows = ((data ?? []) as TaskRow[]).sort((a, b) =>
    (a.starts_at ?? "").localeCompare(b.starts_at ?? ""),
  );

  for (const src of rows) {
    const input: CreateTaskInput = {
      area_id: src.area_id,
      subproject_id: src.subproject_id,
      goal_id: src.goal_id,
      habit_id: src.habit_id,
      ...(src.dimension_id ? { dimension_id: src.dimension_id } : {}),
      title: src.title,
      description: src.description,
      priority: src.priority,
      status: "pending",
      source: "manual",
      activity_type: src.activity_type,
      starts_at: shiftDays(src.starts_at, days),
      ends_at: shiftDays(src.ends_at, days),
      estimated_duration_min: src.estimated_duration_min,
    };

    let copy: TaskRow;
    try {
      copy = await createTask(input);
    } catch (err) {
      const conflict = parseEventConflictError(err);
      const code = (err as { code?: string })?.code;
      result.failed.push({
        title: src.title,
        reason:
          conflict || code === "CA001" || code === "23P01"
            ? conflict
              ? `Choca con "${conflict.title}".`
              : "Choca con otro evento."
            : err instanceof Error
              ? err.message
              : "No se pudo copiar.",
      });
      continue;
    }
    result.copied++;

    // Etiquetas y recordatorio: si fallan, la copia igual queda.
    try {
      const tagIds = await fetchTaskTagIds(src.id);
      if (tagIds.length > 0) await setTaskTags(copy.id, tagIds);
    } catch {
      // sin etiquetas
    }
    try {
      const offset = await getTaskReminderOffset(src.id, src.starts_at);
      if (offset != null) await setTaskReminder(copy.id, copy.starts_at, offset);
    } catch {
      // sin recordatorio
    }
  }
  return result;
}
