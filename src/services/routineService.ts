/**
 * ========================================================
 * Archivo: routineService — Rutinas
 *
 * Una Rutina es una actividad operativa que se repite cada semana
 * dentro de una Dimensión (p. ej. "Pagar sueldos", "Historias de
 * Instagram"). No termina (no es Proyecto) ni se cultiva (no es
 * Hábito): es trabajo que hay que hacer.
 *
 * Reglas del dominio:
 * - Pertenece a una Dimensión (obligatoria); el Área se toma de ella.
 * - Frecuencia semanal: días de la semana (0 = domingo … 6 = sábado).
 * - Si tiene hora y duración, cada ocurrencia se crea como EVENTO;
 *   si no, como TAREA de ese día (con la duración como estimada).
 * - Las tareas de la semana se crean en el Ritual del domingo
 *   ("Repetir en la nueva semana"): la app las propone ya marcadas y
 *   el usuario confirma. Nada se crea solo.
 * - Cada tarea generada es una tarea DIRECTA de la Dimensión
 *   (`dimension_id`) con `routine_id`. Si no se hizo, se marca
 *   "No la hice": baja el cumplimiento, pero no se acumula.
 * - Se archiva con `archived_at`; nunca se elimina.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { createTask, type CreateTaskInput, type TaskRow } from "@/services/taskService";
import { setTaskTags } from "@/services/tagService";
import { parseEventConflictError } from "@/services/eventConflictService";

export type RoutineRow = Database["public"]["Tables"]["routines"]["Row"];
export type RoutineInsert = Database["public"]["Tables"]["routines"]["Insert"];
export type RoutineUpdate = Database["public"]["Tables"]["routines"]["Update"];
type Priority = Database["public"]["Enums"]["task_priority"];

/** Rutina lista para la interfaz, con su medición del mes en curso. */
export interface RutinaNode {
  id: string;
  nombre: string;
  descripcion: string | null;
  areaId: string;
  dimensionId: string;
  /** 0 = domingo … 6 = sábado. */
  diasSemana: number[];
  /** "HH:mm" o null (sin hora: se crea como tarea del día). */
  hora: string | null;
  duracionMin: number | null;
  prioridad: Priority;
  tagIds: string[];
  /** Ids de todas sus tareas (para no repetirlas en otras listas). */
  taskIds: string[];
  /** Día (YYYY-MM-DD local) y estado de cada tarea con fecha. */
  ocurrencias: { fecha: string; status: string }[];
  mes: RutinaMes;
}

export interface RutinaMes {
  /** Ocurrencias esperadas desde el día 1 hasta hoy. */
  esperadas: number;
  hechas: number;
  noHechas: number;
  /** Minutos dedicados (tiempo real; si no, estimado; eventos: horario). */
  minutos: number;
}

type RawRoutineTask = {
  id: string;
  status: string;
  activity_type: "task" | "event";
  starts_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
  actual_duration_min: number | null;
  estimated_duration_min: number | null;
  archived_at: string | null;
};

type RawRoutine = RoutineRow & { tasks: RawRoutineTask[] | null };

// ------------------------------------------------------------
// Lectura
// ------------------------------------------------------------

/**
 * Rutinas activas con su medición del mes. Si la migración de Rutinas
 * aún no está aplicada, devuelve [] (el resto de la app sigue igual).
 */
export async function fetchRoutineNodes(): Promise<RutinaNode[]> {
  const { data, error } = await supabase
    .from("routines")
    .select(
      "*, tasks(id, status, activity_type, starts_at, ends_at, completed_at, actual_duration_min, estimated_duration_min, archived_at)",
    )
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) return [];
  return ((data ?? []) as unknown as RawRoutine[]).map(mapRoutine);
}

export function horaDe(startTime: string | null): string | null {
  return startTime ? startTime.slice(0, 5) : null;
}

function mapRoutine(r: RawRoutine): RutinaNode {
  const tasks = (r.tasks ?? []).filter((t) => !t.archived_at);
  return {
    id: r.id,
    nombre: r.name,
    descripcion: r.description,
    areaId: r.area_id,
    dimensionId: r.dimension_id,
    diasSemana: [...(r.weekdays ?? [])].sort((a, b) => a - b),
    hora: horaDe(r.start_time),
    duracionMin: r.duration_min,
    prioridad: r.priority,
    tagIds: r.tag_ids ?? [],
    taskIds: tasks.map((t) => t.id),
    ocurrencias: tasks
      .filter((t) => !!t.starts_at)
      .map((t) => ({ fecha: localDate(new Date(t.starts_at!)), status: t.status })),
    mes: monthStats(r.weekdays ?? [], tasks, new Date(r.created_at)),
  };
}

function minutesOf(t: RawRoutineTask): number {
  if (t.activity_type === "event") {
    if (!t.starts_at || !t.ends_at) return 0;
    const m = (new Date(t.ends_at).getTime() - new Date(t.starts_at).getTime()) / 60000;
    return m > 0 ? Math.round(m) : 0;
  }
  return t.actual_duration_min ?? t.estimated_duration_min ?? 0;
}

function monthStats(
  weekdays: number[],
  tasks: RawRoutineTask[],
  creada: Date,
  now = new Date(),
): RutinaMes {
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const finHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  // Las ocurrencias esperadas se cuentan desde el día en que se creó la Rutina.
  const diaCreada = new Date(creada.getFullYear(), creada.getMonth(), creada.getDate());
  const desde = diaCreada > inicio ? diaCreada : inicio;
  let esperadas = 0;
  for (let d = new Date(desde); d <= finHoy; d.setDate(d.getDate() + 1)) {
    if (weekdays.includes(d.getDay())) esperadas++;
  }
  let hechas = 0;
  let noHechas = 0;
  let minutos = 0;
  for (const t of tasks) {
    if (!t.starts_at) continue;
    const d = new Date(t.starts_at);
    if (d < inicio || d > finHoy) continue;
    if (t.status === "completed") {
      hechas++;
      minutos += minutesOf(t);
    } else if (t.status === "not_done") {
      noHechas++;
    }
  }
  return { esperadas, hechas, noHechas, minutos };
}

// ------------------------------------------------------------
// Escritura
// ------------------------------------------------------------

export async function createRoutine(input: RoutineInsert): Promise<RoutineRow> {
  const { data, error } = await supabase.from("routines").insert(input).select("*").single();
  if (error) throw friendlyError(error);
  return data as RoutineRow;
}

export async function updateRoutine(id: string, patch: RoutineUpdate): Promise<RoutineRow> {
  const { data, error } = await supabase
    .from("routines")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw friendlyError(error);
  return data as RoutineRow;
}

export async function archiveRoutine(id: string): Promise<void> {
  await updateRoutine(id, { archived_at: new Date().toISOString() });
}

function friendlyError(error: { code?: string; message: string }): Error {
  if (error.code === "23505")
    return new Error("Ya hay una rutina con ese nombre en esta dimensión.");
  if (error.message.includes("routines_weekdays_valid"))
    return new Error("Elige al menos un día de la semana.");
  return new Error(error.message);
}

// ------------------------------------------------------------
// Ocurrencias de una semana
// ------------------------------------------------------------

export interface RoutineOccurrence {
  routineId: string;
  nombre: string;
  /** Fecha local YYYY-MM-DD. */
  fecha: string;
  /** Inicio ISO (00:00 local si no tiene hora). */
  startsAt: string;
  /** Fin ISO si es evento (hora + duración); null si es tarea. */
  endsAt: string | null;
  duracionMin: number | null;
  /** Clave estable para selección: `${routineId}|${fecha}`. */
  key: string;
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Ocurrencias de una Rutina en la semana que empieza en `weekStart`
 * (lunes 00:00 local), ordenadas por día.
 */
export function occurrencesForWeek(r: RutinaNode, weekStart: Date): RoutineOccurrence[] {
  const out: RoutineOccurrence[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    if (!r.diasSemana.includes(day.getDay())) continue;
    const start = new Date(day);
    if (r.hora) {
      const [h, m] = r.hora.split(":").map(Number);
      start.setHours(h, m, 0, 0);
    }
    const esEvento = !!r.hora && !!r.duracionMin;
    const end = esEvento ? new Date(start.getTime() + (r.duracionMin ?? 0) * 60000) : null;
    const fecha = localDate(day);
    out.push({
      routineId: r.id,
      nombre: r.nombre,
      fecha,
      startsAt: start.toISOString(),
      endsAt: end ? end.toISOString() : null,
      duracionMin: r.duracionMin,
      key: `${r.id}|${fecha}`,
    });
  }
  return out;
}

/**
 * Claves `${routineId}|${fecha}` de las ocurrencias que YA existen como
 * tarea en el rango [from, to): sirven para mostrar "Ya está".
 */
export async function existingOccurrenceKeys(from: Date, to: Date): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("tasks")
    .select("routine_id, starts_at")
    .not("routine_id", "is", null)
    .is("archived_at", null)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString());
  if (error) return new Set();
  const keys = new Set<string>();
  for (const t of (data ?? []) as { routine_id: string | null; starts_at: string | null }[]) {
    if (t.routine_id && t.starts_at)
      keys.add(`${t.routine_id}|${localDate(new Date(t.starts_at))}`);
  }
  return keys;
}

export interface CreateOccurrencesResult {
  created: number;
  failed: { title: string; reason: string }[];
}

/** Crea las tareas/eventos de las ocurrencias elegidas. Cada una es independiente. */
export async function createRoutineOccurrences(
  routines: RutinaNode[],
  occurrences: RoutineOccurrence[],
): Promise<CreateOccurrencesResult> {
  const result: CreateOccurrencesResult = { created: 0, failed: [] };
  const byId = new Map(routines.map((r) => [r.id, r]));
  const sorted = [...occurrences].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  for (const o of sorted) {
    const r = byId.get(o.routineId);
    if (!r) continue;
    const input: CreateTaskInput = {
      area_id: r.areaId,
      dimension_id: r.dimensionId,
      routine_id: r.id,
      title: r.nombre,
      description: r.descripcion,
      priority: r.prioridad,
      status: "pending",
      source: "manual",
      activity_type: o.endsAt ? "event" : "task",
      starts_at: o.startsAt,
      ends_at: o.endsAt,
      estimated_duration_min: r.duracionMin,
    };

    let task: TaskRow;
    try {
      task = await createTask(input);
    } catch (err) {
      const conflict = parseEventConflictError(err);
      const code = (err as { code?: string })?.code;
      result.failed.push({
        title: `${r.nombre} (${o.fecha.slice(8)}/${o.fecha.slice(5, 7)})`,
        reason: conflict
          ? `Choca con "${conflict.title}".`
          : code === "CA001" || code === "23P01"
            ? "Choca con otro evento."
            : err instanceof Error
              ? err.message
              : "No se pudo crear.",
      });
      continue;
    }
    result.created++;

    if (r.tagIds.length > 0) {
      try {
        await setTaskTags(task.id, r.tagIds);
      } catch {
        // Si una etiqueta ya no existe, la tarea queda igual.
      }
    }
  }
  return result;
}

/**
 * Al crear una Rutina: genera sus días desde hoy hasta el domingo de
 * esta semana. Hoy se incluye siempre, aunque su hora ya haya pasado:
 * así se puede marcar hecha (o "No la hice") y el cumplimiento del mes
 * calza. Desde la semana siguiente, se proponen en el Ritual del domingo.
 */
export async function createRestOfThisWeek(
  row: RoutineRow,
  now: Date = new Date(),
): Promise<CreateOccurrencesResult> {
  const node = mapRoutine({ ...row, tasks: [] });
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const pendientes = occurrencesForWeek(node, lunes).filter((o) => o.fecha >= localDate(hoy));
  return createRoutineOccurrences([node], pendientes);
}

export const DIAS_SEMANA: { label: string; dia: number }[] = [
  { label: "L", dia: 1 },
  { label: "M", dia: 2 },
  { label: "M", dia: 3 },
  { label: "J", dia: 4 },
  { label: "V", dia: 5 },
  { label: "S", dia: 6 },
  { label: "D", dia: 0 },
];

const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "Lunes y jueves · 09:00 · 30 min" */
export function describeRoutine(
  r: Pick<RutinaNode, "diasSemana" | "hora" | "duracionMin">,
): string {
  const orden = [1, 2, 3, 4, 5, 6, 0].filter((d) => r.diasSemana.includes(d));
  const dias =
    orden.length === 7
      ? "Todos los días"
      : orden.length === 5 && orden.every((d) => d >= 1 && d <= 5)
        ? "De lunes a viernes"
        : orden
            .map((d) => NOMBRES_DIA[d])
            .join(", ")
            .replace(/, ([^,]*)$/, " y $1");
  const partes = [dias.charAt(0).toUpperCase() + dias.slice(1)];
  if (r.hora) partes.push(r.hora);
  if (r.duracionMin) partes.push(`${r.duracionMin} min`);
  return partes.join(" · ");
}

export interface RutinaSemanaDia {
  fecha: string;
  inicial: string;
  /** Según sus días, ¿corresponde ese día? */
  esperado: boolean;
  /** Estado de la tarea de ese día, si existe. */
  estado: "hecha" | "no_hecha" | "pendiente" | "sin_tarea";
  futuro: boolean;
}

/** Semana (lunes a domingo) de una Rutina, para los puntos del Tablero. */
export function routineWeek(
  r: RutinaNode,
  weekStart: Date,
  now = new Date(),
): {
  hechas: number;
  esperadas: number;
  dias: RutinaSemanaDia[];
} {
  const hoy = localDate(now);
  const porFecha = new Map<string, string>();
  for (const o of r.ocurrencias) {
    // Si hay varias el mismo día, gana la completada.
    if (porFecha.get(o.fecha) !== "completed") porFecha.set(o.fecha, o.status);
  }
  const dias: RutinaSemanaDia[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const fecha = localDate(d);
    const st = porFecha.get(fecha);
    dias.push({
      fecha,
      inicial: "DLMMJVS"[d.getDay()],
      esperado: r.diasSemana.includes(d.getDay()),
      estado:
        st === "completed"
          ? "hecha"
          : st === "not_done"
            ? "no_hecha"
            : st
              ? "pendiente"
              : "sin_tarea",
      futuro: fecha > hoy,
    });
  }
  const esperadas = dias.filter((d) => d.esperado);
  return {
    hechas: esperadas.filter((d) => d.estado === "hecha").length,
    esperadas: esperadas.length,
    dias,
  };
}
