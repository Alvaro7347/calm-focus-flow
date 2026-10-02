/**
 * ========================================================
 * Archivo: tableroService
 *
 * Responsabilidad:
 * Construye la jerarquía Área → Proyecto → Subproyecto → Tareas
 * a partir de la estructura organizacional real almacenada en
 * Supabase. Es la única fuente de datos de la pantalla Tablero.
 *
 * Dependencias:
 * - Cliente de Supabase (`@/integrations/supabase/client`).
 * - Mapper de prioridad (`priorityMapper`).
 *
 * Regla arquitectónica oficial de CalmApp (permanente):
 * - La jerarquía se arma exclusivamente a partir de las
 *   relaciones foráneas reales: `areas → projects → subprojects
 *   → tasks`. Nunca se infieren nodos desde nombres de tareas.
 * - Este servicio NUNCA crea nodos ficticios (no existen
 *   "Sin proyecto" ni "General" ni ninguna categoría de relleno).
 * - Las tareas archivadas (`archived_at IS NOT NULL`) no se
 *   incluyen en el árbol. Sí se incluyen las completadas: la UI
 *   decide cómo representarlas.
 * - Las Áreas / Proyectos / Subproyectos archivados tampoco se
 *   incluyen.
 *
 * Estado de migración:
 * - Tablero opera 100% sobre Supabase. Con esta iteración,
 *   TODA la aplicación (Crear tarea, FOCO, Calendar y Tablero)
 *   utiliza Supabase como única fuente oficial de datos.
 *
 * Reactividad:
 * - La pantalla consume esta capa vía TanStack Query con la
 *   queryKey ["tablero"]. Al crear/editar/archivar tareas o
 *   nodos organizacionales debe invalidarse ["tablero"] para
 *   que el árbol se refresque sin recargar la página.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";
import { mapDbPriorityToUi, type DbPriority } from "@/services/mappers/priorityMapper";
import type { Tarea, ProgressMode, RecurrenceRule } from "@/types/tarea";

export interface SubproyectoNode {
  id: string;
  nombre: string;
  slug: string;
  tareas: Tarea[];
  /**
   * Conteo canónico de "tareas pendientes activas": únicamente
   * `activity_type = 'task'` con `status = 'pending'` y sin
   * archivar. Excluye eventos y tareas completadas.
   */
  tareasPendientes: number;
  /** % de avance de la Etapa (0-100). Ver `progress_mode`. */
  progresoPct: number;
  /** 'auto' = recalculado desde sus tareas; 'manual' = fijado a mano. */
  modoProgreso: ProgressMode;
  /** Fecha objetivo de la Etapa, formato YYYY-MM-DD. */
  fechaObjetivo: string | null;
}

export interface ProyectoNode {
  id: string;
  nombre: string;
  slug: string;
  /**
   * Slug de la paleta CalmApp heredado del Área. Puede ser `null`
   * cuando el Área aún no tiene color (usa color por defecto).
   */
  color: string | null;
  subproyectos: SubproyectoNode[];
  /** Suma de `tareasPendientes` de sus subproyectos. */
  totalTareas: number;
  /** % de avance del Proyecto (0-100). Ver `progress_mode`. */
  progresoPct: number;
  /** 'auto' = promedio de sus Etapas; 'manual' = fijado a mano. */
  modoProgreso: ProgressMode;
  /** Fecha objetivo del Proyecto, formato YYYY-MM-DD. */
  fechaObjetivo: string | null;
  /** Visión emocional del Proyecto (texto libre). */
  visionTexto: string | null;
  /** Área a la que pertenece (para selectores de Dimensión). */
  areaId: string;
  /** Dimensión del Área, o null si está "sin dimensión". */
  dimensionId: string | null;
}

export interface MetaNode {
  id: string;
  nombre: string;
  slug: string;
  tareas: Tarea[];
  tareasPendientes: number;
  /** % de avance de la Meta (0-100). Ver `progress_mode`. */
  progresoPct: number;
  modoProgreso: ProgressMode;
  /** Fecha objetivo de la Meta, formato YYYY-MM-DD. */
  fechaObjetivo: string | null;
  /** Visión emocional de la Meta (opcional; a diferencia de la Etapa). */
  visionTexto: string | null;
}

export interface ObjetivoNode {
  id: string;
  nombre: string;
  slug: string;
  metas: MetaNode[];
  /** Suma de `tareasPendientes` de sus Metas. */
  totalTareas: number;
  /** % de avance del Objetivo (0-100). Ver `progress_mode`. */
  progresoPct: number;
  /** 'auto' = promedio de sus Metas; 'manual' = fijado a mano. */
  modoProgreso: ProgressMode;
  /** Fecha objetivo, formato YYYY-MM-DD. */
  fechaObjetivo: string | null;
  /** Visión emocional del Objetivo (texto libre). */
  visionTexto: string | null;
  /** Área a la que pertenece (para selectores de Dimensión). */
  areaId: string;
  /** Dimensión del Área, o null si está "sin dimensión". */
  dimensionId: string | null;
}

export interface HabitoNode {
  id: string;
  nombre: string;
  slug: string;
  /** Área a la que pertenece (para selectores de Dimensión). */
  areaId?: string;
  /** Dimensión del Área, o null si está "sin dimensión". */
  dimensionId?: string | null;
  razon: string | null;
  futuroDeseado: string | null;
  frecuencia: RecurrenceRule | null;
  /** true si ya se marcó cumplido el día de hoy. */
  hoyCumplido: boolean;
  /**
   * % de cumplimiento del mes calendario en curso, hasta hoy.
   * Simplificación v1: si `frecuencia.diasSemana` está definido, solo
   * cuentan como "esperados" esos días de la semana; en cualquier otro
   * caso (diaria/semanal sin días/mensual/anual/sin frecuencia) se
   * asume "esperado todos los días" del mes transcurrido.
   */
  cumplimientoPct: number;
  /**
   * Fechas (YYYY-MM-DD) en que el hábito se cumplió: check del hábito
   * o tarea vinculada completada ese día. Base para medir cualquier
   * semana con `habitWeekStats` sin volver a la base.
   */
  diasCumplidos: string[];
  /** Fechas (YYYY-MM-DD) marcadas como "No la hice" (y no cumplidas). */
  diasNoHechos: string[];
}

export interface AreaNode {
  id: string;
  nombre: string;
  slug: string;
  /** Slug de la paleta CalmApp. Puede ser `null` (usa color por defecto). */
  color: string | null;
  proyectos: ProyectoNode[];
  /** Objetivo → Meta, hermano de Proyecto → Etapa dentro de la misma Área. */
  objetivos: ObjetivoNode[];
  /** Hábitos, hermanos de Proyecto y Objetivo dentro de la misma Área. */
  habitos: HabitoNode[];
  /**
   * Dimensiones activas del Área (creadas por el usuario), con sus
   * tareas directas. Proyectos/Objetivos/Hábitos indican la suya en
   * `dimensionId`. Vacío si el Área no tiene Dimensiones.
   */
  dimensiones: DimensionNode[];
  /** Suma de `tareasPendientes` de sus proyectos. */
  totalTareas: number;
}

export interface DimensionNode {
  id: string;
  nombre: string;
  /** Tareas DIRECTAS de la Dimensión (sin Proyecto, Meta ni Hábito). */
  tareas: Tarea[];
  tareasPendientes: number;
}

// ------------------------------------------------------------
// Tipos crudos de la respuesta del select anidado. Se mantienen
// locales al servicio porque no forman parte del contrato público.
// ------------------------------------------------------------
type RawTask = {
  id: string;
  title: string;
  status: string;
  activity_type: "task" | "event";
  priority: DbPriority | null;
  starts_at: string | null;
  estimated_duration_min: number | null;
  updated_at: string;
  archived_at: string | null;
};

type RawSubproject = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  progress_pct: number;
  progress_mode: ProgressMode;
  target_date: string | null;
  tasks: RawTask[] | null;
};

type RawProject = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  progress_pct: number;
  progress_mode: ProgressMode;
  target_date: string | null;
  vision_text: string | null;
  dimension_id?: string | null;
  subprojects: RawSubproject[] | null;
};

type RawGoal = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  progress_pct: number;
  progress_mode: ProgressMode;
  target_date: string | null;
  vision_text: string | null;
  tasks: RawTask[] | null;
};

type RawObjective = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  progress_pct: number;
  progress_mode: ProgressMode;
  target_date: string | null;
  vision_text: string | null;
  dimension_id?: string | null;
  goals: RawGoal[] | null;
};

type RawHabitLog = {
  log_date: string;
  done: boolean;
};

type RawHabitTask = {
  status: string;
  completed_at: string | null;
  starts_at?: string | null;
  archived_at: string | null;
};

type RawHabit = {
  id: string;
  name: string;
  archived_at: string | null;
  reason_text: string | null;
  desired_future_text: string | null;
  frequency_rule: unknown;
  dimension_id?: string | null;
  habit_logs: RawHabitLog[] | null;
  /** Tareas vinculadas al hábito (completarlas también cuenta como hecho). */
  tasks?: RawHabitTask[] | null;
};

type RawArea = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  color: string | null;
  projects: RawProject[] | null;
  objectives: RawObjective[] | null;
  habits: RawHabit[] | null;
  dimensions?: RawDimension[] | null;
};

type RawDimension = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  tasks: RawTask[] | null;
};

function isoDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  return isoDate(new Date().toISOString());
}

/**
 * Cuenta cuántos días, dentro de [desde, hasta] (ambos inclusive), se
 * consideran "esperados" para un Hábito según su frecuencia.
 * Simplificación v1: solo `diasSemana` restringe días; cualquier otro
 * valor de frecuencia (o su ausencia) asume "todos los días".
 */
function diasEsperados(frecuencia: RecurrenceRule | null, desde: Date, hasta: Date): number {
  const diasSemana = frecuencia?.diasSemana;
  let n = 0;
  for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
    if (!diasSemana || diasSemana.length === 0 || diasSemana.includes(d.getDay())) n++;
  }
  return n;
}

function mapHabit(h: RawHabit): HabitoNode {
  const frecuencia = (h.frequency_rule as RecurrenceRule | null) ?? null;
  const logs = (h.habit_logs ?? []).filter((l) => l.done);
  // "Hoy cumplido" refleja el check del hábito (lo que se puede desmarcar).
  const loggedDates = new Set(logs.map((l) => l.log_date));
  // Para medir, un día cuenta como hecho si se marcó el check del hábito
  // O si se completó ese día una tarea vinculada al hábito.
  const doneDates = new Set(loggedDates);
  // Días marcados explícitamente como "No la hice" (tarea vinculada con
  // status not_done), por el día para el que estaba planificada.
  const notDoneDates = new Set<string>();
  for (const t of h.tasks ?? []) {
    if (t.archived_at) continue;
    if (t.status === "completed" && t.completed_at) doneDates.add(isoDate(t.completed_at));
    else if (t.status === "not_done" && t.starts_at) notDoneDates.add(isoDate(t.starts_at));
  }

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const esperados = diasEsperados(frecuencia, inicioMes, hoy);
  const cumplidosEsteMes = [...doneDates].filter((fecha) => {
    const d = new Date(fecha + "T00:00:00");
    return d >= inicioMes && d <= hoy;
  }).length;

  return {
    id: h.id,
    nombre: h.name,
    slug: slugify(h.name),
    razon: h.reason_text,
    futuroDeseado: h.desired_future_text,
    frecuencia,
    hoyCumplido: loggedDates.has(todayIso()),
    cumplimientoPct: esperados > 0 ? Math.round((cumplidosEsteMes / esperados) * 100) : 0,
    diasCumplidos: [...doneDates],
    diasNoHechos: [...notDoneDates].filter((d) => !doneDates.has(d)),
  };
}

// ------------------------------------------------------------
// Medición semanal de hábitos
// ------------------------------------------------------------

const DIAS_CORTOS = ["D", "L", "M", "M", "J", "V", "S"];

export interface HabitWeekDay {
  fecha: string;
  /** Inicial del día (L, M, M, J, V, S, D). */
  inicial: string;
  /** Según la frecuencia del hábito, ¿se esperaba ese día? */
  esperado: boolean;
  cumplido: boolean;
  /** Marcado explícitamente como "No la hice". */
  noHecho: boolean;
  /** Día posterior a hoy (aún no llega). */
  futuro: boolean;
}

export interface HabitWeekStats {
  /** Días esperados que se cumplieron. */
  cumplidos: number;
  /** Días esperados en la semana completa. */
  esperados: number;
  dias: HabitWeekDay[];
}

/**
 * Cumplimiento de un hábito en la semana que empieza en `weekStart`
 * (fecha local, 00:00). Cuenta sólo los días esperados según su
 * frecuencia (si no tiene días definidos, los 7 días).
 */
export function habitWeekStats(
  habito: Pick<HabitoNode, "frecuencia" | "diasCumplidos"> & { diasNoHechos?: string[] },
  weekStart: Date,
  now: Date = new Date(),
): HabitWeekStats {
  const done = new Set(habito.diasCumplidos);
  const notDone = new Set(habito.diasNoHechos ?? []);
  const diasSemana = habito.frecuencia?.diasSemana;
  const hoy = isoDate(now.toISOString());
  const dias: HabitWeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const fecha = isoDate(d.toISOString());
    const esperado = !diasSemana || diasSemana.length === 0 || diasSemana.includes(d.getDay());
    dias.push({
      fecha,
      inicial: DIAS_CORTOS[d.getDay()],
      esperado,
      cumplido: done.has(fecha),
      noHecho: !done.has(fecha) && notDone.has(fecha),
      futuro: fecha > hoy,
    });
  }
  const esperadosDias = dias.filter((d) => d.esperado);
  return {
    cumplidos: esperadosDias.filter((d) => d.cumplido).length,
    esperados: esperadosDias.length,
    dias,
  };
}

/** Lunes (00:00 local) de la semana que contiene `date`. */
export function mondayOf(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

// ------------------------------------------------------------
// Metas completadas
// ------------------------------------------------------------

/**
 * Una Meta se considera COMPLETADA cuando su progreso está fijado a
 * mano en 100 %. Las Metas completadas no se archivan (seguirían
 * fuera del promedio del Objetivo); sólo se muestran aparte.
 */
export function isMetaCompletada(meta: Pick<MetaNode, "modoProgreso" | "progresoPct">): boolean {
  return meta.modoProgreso === "manual" && meta.progresoPct >= 100;
}

function mapTask(
  row: RawTask,
  areaName: string,
  projectName: string,
  projectColor: string | null,
  subName: string,
): Tarea {
  const starts = row.starts_at ? new Date(row.starts_at) : null;
  const hasTime = !!starts && (starts.getHours() !== 0 || starts.getMinutes() !== 0);
  const horaInicio =
    hasTime && starts
      ? `${String(starts.getHours()).padStart(2, "0")}:${String(starts.getMinutes()).padStart(2, "0")}`
      : undefined;

  return {
    id: row.id,
    titulo: row.title,
    area: areaName,
    proyecto: projectName,
    proyectoColor: projectColor,
    subproyecto: subName,
    fechaProgramada: row.starts_at ? isoDate(row.starts_at) : undefined,
    horaInicio,
    duracionMin: row.estimated_duration_min ?? undefined,
    // `categoriaFoco` es un campo del dominio FOCO. Tablero no lo
    // interpreta, pero `Tarea` lo exige por contrato de tipo.
    categoriaFoco: "hoy",
    completada: row.status === "completed",
    noHecha: row.status === "not_done" || undefined,
    priority: mapDbPriorityToUi(row.priority),
  };
}

/** Variante de `mapTask` para tareas vinculadas a una Meta (sin Proyecto/Etapa). */
function mapGoalTask(row: RawTask, areaName: string, metaId: string): Tarea {
  const starts = row.starts_at ? new Date(row.starts_at) : null;
  const hasTime = !!starts && (starts.getHours() !== 0 || starts.getMinutes() !== 0);
  const horaInicio =
    hasTime && starts
      ? `${String(starts.getHours()).padStart(2, "0")}:${String(starts.getMinutes()).padStart(2, "0")}`
      : undefined;

  return {
    id: row.id,
    titulo: row.title,
    area: areaName,
    metaId,
    fechaProgramada: row.starts_at ? isoDate(row.starts_at) : undefined,
    horaInicio,
    duracionMin: row.estimated_duration_min ?? undefined,
    categoriaFoco: "hoy",
    completada: row.status === "completed",
    noHecha: row.status === "not_done" || undefined,
    priority: mapDbPriorityToUi(row.priority),
  };
}

/**
 * Obtiene el árbol completo Área → Proyecto → Subproyecto → Tareas
 * del usuario autenticado desde Supabase. Excluye nodos archivados
 * en todos los niveles.
 *
 * Nota: `RLS` en Supabase se encarga de acotar el resultado al
 * usuario actual; aquí no se filtra por `user_id` manualmente.
 */
export async function fetchAreaTree(): Promise<AreaNode[]> {
  // Con Dimensiones. Si la migración de Dimensiones aún no está
  // aplicada, la consulta falla y se usa la versión anterior: el
  // Tablero sigue funcionando igual que antes.
  const withDimensions = await supabase
    .from("areas")
    .select(`id, name, display_order, archived_at, color,
       projects (
         id, name, display_order, archived_at, dimension_id,
         progress_pct, progress_mode, target_date, vision_text,
         subprojects (
           id, name, display_order, archived_at,
           progress_pct, progress_mode, target_date,
           tasks (
             id, title, status, activity_type, priority, starts_at,
             estimated_duration_min, updated_at, archived_at
           )
         )
       ),
       objectives (
         id, name, display_order, archived_at, dimension_id,
         progress_pct, progress_mode, target_date, vision_text,
         goals (
           id, name, display_order, archived_at,
           progress_pct, progress_mode, target_date, vision_text,
           tasks (
             id, title, status, activity_type, priority, starts_at,
             estimated_duration_min, updated_at, archived_at
           )
         )
       ),
       habits (
         id, name, archived_at, dimension_id, reason_text, desired_future_text, frequency_rule,
         habit_logs ( log_date, done ),
         tasks ( status, completed_at, starts_at, archived_at )
       ),
       dimensions (
         id, name, display_order, archived_at,
         tasks (
           id, title, status, activity_type, priority, starts_at,
           estimated_duration_min, updated_at, archived_at
         )
       )`)
    .is("archived_at", null)
    .order("display_order", { ascending: true });

  let data: unknown = withDimensions.data;
  if (withDimensions.error) {
    const legacy = await supabase
      .from("areas")
      .select(`id, name, display_order, archived_at, color,
       projects (
         id, name, display_order, archived_at,
         progress_pct, progress_mode, target_date, vision_text,
         subprojects (
           id, name, display_order, archived_at,
           progress_pct, progress_mode, target_date,
           tasks (
             id, title, status, activity_type, priority, starts_at,
             estimated_duration_min, updated_at, archived_at
           )
         )
       ),
       objectives (
         id, name, display_order, archived_at,
         progress_pct, progress_mode, target_date, vision_text,
         goals (
           id, name, display_order, archived_at,
           progress_pct, progress_mode, target_date, vision_text,
           tasks (
             id, title, status, activity_type, priority, starts_at,
             estimated_duration_min, updated_at, archived_at
           )
         )
       ),
       habits (
         id, name, archived_at, reason_text, desired_future_text, frequency_rule,
         habit_logs ( log_date, done ),
         tasks ( status, completed_at, starts_at, archived_at )
       )`)
      .is("archived_at", null)
      .order("display_order", { ascending: true });
    if (legacy.error) throw legacy.error;
    data = legacy.data;
  }

  const rows = (data ?? []) as unknown as RawArea[];

  return rows.map((a) => {
    // El color se define en el Área; Proyectos, Subproyectos y Tareas
    // lo heredan visualmente (se propaga hacia abajo para que los
    // consumidores actuales sigan leyendo `proyecto.color` sin cambios).
    const areaColor = a.color;
    const proyectos: ProyectoNode[] = (a.projects ?? [])
      .filter((p) => p.archived_at === null)
      .sort((x, y) => x.display_order - y.display_order)
      .map((p) => {
        const subproyectos: SubproyectoNode[] = (p.subprojects ?? [])
          .filter((s) => s.archived_at === null)
          .sort((x, y) => x.display_order - y.display_order)
          .map((s) => {
            const rawTareas = (s.tasks ?? []).filter((t) => t.archived_at === null);
            const tareas = rawTareas.map((t) => mapTask(t, a.name, p.name, areaColor, s.name));
            // Contador canónico: sólo tareas (no eventos) pendientes.
            const tareasPendientes = rawTareas.filter(
              (t) => t.activity_type === "task" && t.status === "pending",
            ).length;
            return {
              id: s.id,
              nombre: s.name,
              slug: slugify(s.name),
              tareas,
              tareasPendientes,
              progresoPct: s.progress_pct,
              modoProgreso: s.progress_mode,
              fechaObjetivo: s.target_date,
            };
          });
        const totalTareas = subproyectos.reduce((n, s) => n + s.tareasPendientes, 0);
        return {
          id: p.id,
          nombre: p.name,
          slug: slugify(p.name),
          color: areaColor,
          subproyectos,
          totalTareas,
          progresoPct: p.progress_pct,
          modoProgreso: p.progress_mode,
          fechaObjetivo: p.target_date,
          visionTexto: p.vision_text,
          areaId: a.id,
          dimensionId: p.dimension_id ?? null,
        };
      });
    const totalTareasProyectos = proyectos.reduce((n, p) => n + p.totalTareas, 0);

    const objetivos: ObjetivoNode[] = (a.objectives ?? [])
      .filter((o) => o.archived_at === null)
      .sort((x, y) => x.display_order - y.display_order)
      .map((o) => {
        const metas: MetaNode[] = (o.goals ?? [])
          .filter((g) => g.archived_at === null)
          .sort((x, y) => x.display_order - y.display_order)
          .map((g) => {
            const rawTareas = (g.tasks ?? []).filter((t) => t.archived_at === null);
            const tareas = rawTareas.map((t) => mapGoalTask(t, a.name, g.id));
            const tareasPendientes = rawTareas.filter(
              (t) => t.activity_type === "task" && t.status === "pending",
            ).length;
            return {
              id: g.id,
              nombre: g.name,
              slug: slugify(g.name),
              tareas,
              tareasPendientes,
              progresoPct: g.progress_pct,
              modoProgreso: g.progress_mode,
              fechaObjetivo: g.target_date,
              visionTexto: g.vision_text,
            };
          });
        const totalTareasObjetivo = metas.reduce((n, m) => n + m.tareasPendientes, 0);
        return {
          id: o.id,
          nombre: o.name,
          slug: slugify(o.name),
          metas,
          totalTareas: totalTareasObjetivo,
          progresoPct: o.progress_pct,
          modoProgreso: o.progress_mode,
          fechaObjetivo: o.target_date,
          visionTexto: o.vision_text,
          areaId: a.id,
          dimensionId: o.dimension_id ?? null,
        };
      });

    const habitos: HabitoNode[] = (a.habits ?? [])
      .filter((h) => h.archived_at === null)
      .map((h) => ({ ...mapHabit(h), areaId: a.id, dimensionId: h.dimension_id ?? null }));

    const dimensiones: DimensionNode[] = (a.dimensions ?? [])
      .filter((d) => d.archived_at === null)
      .sort((x, y) => x.display_order - y.display_order)
      .map((d) => {
        const rawTareas = (d.tasks ?? []).filter((t) => t.archived_at === null);
        return {
          id: d.id,
          nombre: d.name,
          tareas: rawTareas
            .map((t) => mapGoalTask(t, a.name, ""))
            .map((t) => ({ ...t, metaId: undefined })),
          tareasPendientes: rawTareas.filter(
            (t) => t.activity_type === "task" && t.status === "pending",
          ).length,
        };
      });

    return {
      id: a.id,
      nombre: a.name,
      slug: slugify(a.name),
      color: areaColor,
      proyectos,
      objetivos,
      habitos,
      dimensiones,
      totalTareas: totalTareasProyectos + objetivos.reduce((n, o) => n + o.totalTareas, 0),
    };
  });
}

/** Busca un área por slug dentro de un árbol ya cargado. */
export function findAreaBySlug(tree: AreaNode[], areaSlug: string): AreaNode | undefined {
  return tree.find((a) => a.slug === areaSlug);
}

/** Resumen ligero de áreas (para el picker cuando no hay `area` en la URL). */
export interface AreaSummary {
  nombre: string;
  slug: string;
  totalTareas: number;
}

export function toAreaSummaries(tree: AreaNode[]): AreaSummary[] {
  return tree.map((a) => ({ nombre: a.nombre, slug: a.slug, totalTareas: a.totalTareas }));
}
