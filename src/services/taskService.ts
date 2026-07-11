/**
 * ========================================================
 * Archivo: taskService
 *
 * Responsabilidad:
 * Única fuente de verdad para el acceso a tareas. Cualquier
 * pantalla o servicio debe pasar por aquí — nunca importar
 * mocks directamente ni conocer el origen de los datos.
 *
 * Estado de migración:
 * - Crear tarea → Supabase.
 * - FOCO → Supabase (`fetchFocusTasks()`).
 * - Calendar → Supabase (`fetchScheduledTasks()`).
 * - Tablero → Supabase (`tableroService.fetchAreaTree()`).
 * - Sidebar / AreasDrawer → Supabase (`areaService.fetchAreasWithCounts()`).
 * - La migración a Supabase está COMPLETA: ninguna pantalla ni
 *   servicio en runtime consume `mockTasks`. Los mocks sobreviven
 *   únicamente en `seedService` como bootstrap del entorno de
 *   desarrollo (ver `seedService.ts`).

 *
 * Reglas de dominio (ver ARCHITECTURE.md):
 * - Toda tarea pertenece obligatoriamente a un usuario y a un
 *   subproyecto. Área y Proyecto se derivan por relación.
 * - No existe eliminación física: usar `archiveTask()` que
 *   escribe `archived_at`.
 * - Estados válidos: 'pending' | 'waiting' | 'completed'.
 *   `waiting` = detenida a la espera de un tercero. El
 *   archivado NO es un estado: sigue viviendo en `archived_at`.
 * - Las columnas de FOCO NO se almacenan: se calculan en
 *   `fetchFocusTasks()` a partir de `status`, `starts_at` y
 *   `updated_at`.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CategoriaFoco, Tarea } from "@/types/tarea";
import { mapDbPriorityToUi } from "@/services/mappers/priorityMapper";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskSource = Database["public"]["Enums"]["task_source"];

/**
 * Payload de creación. Excluye deliberadamente los campos que
 * gestiona la capa de servicios o la base de datos.
 */
export type CreateTaskInput = Omit<
  TaskInsert,
  "user_id" | "created_at" | "updated_at" | "archived_at" | "completed_at"
>;

// ---------- API asíncrona (Supabase, oficial) ----------

export interface FetchTasksOptions {
  includeArchived?: boolean;
  status?: TaskStatus;
  subprojectId?: string;
}

export async function fetchTasks(options: FetchTasksOptions = {}): Promise<TaskRow[]> {
  let query = supabase.from("tasks").select("*");
  if (!options.includeArchived) query = query.is("archived_at", null);
  if (options.status) query = query.eq("status", options.status);
  if (options.subprojectId) query = query.eq("subproject_id", options.subprojectId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTaskById(id: string): Promise<TaskRow | null> {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Devuelve una tarea junto con los IDs de la jerarquía completa
 * (subproyecto → proyecto → área). Usado por Task Detail en modo
 * `edit` para poder poblar los tres selectores en cascada.
 */
export interface TaskWithHierarchy {
  task: TaskRow;
  subprojectId: string;
  projectId: string;
  areaId: string;
}

export async function fetchTaskForEdit(id: string): Promise<TaskWithHierarchy | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, subprojects!inner(id, project_id, projects!inner(id, area_id))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as TaskRow & {
    subprojects: { id: string; project_id: string; projects: { id: string; area_id: string } };
  };
  const { subprojects, ...task } = row;
  return {
    task: task as TaskRow,
    subprojectId: subprojects.id,
    projectId: subprojects.project_id,
    areaId: subprojects.projects.area_id,
  };
}

/**
 * Claves de invalidación en TanStack Query que dependen del conjunto
 * de tareas. Cualquier mutación (create/update/archive) debe invalidar
 * TODAS estas claves para mantener la consistencia entre pantallas.
 */
export const TASK_INVALIDATION_KEYS: readonly (readonly string[])[] = [
  ["focus"],
  ["calendar"],
  ["tablero"],
  ["areas", "nav"],
] as const;


export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData?.user;
  if (!user) throw new Error("No hay usuario autenticado: no se puede crear la tarea.");

  const payload: TaskInsert = { ...input, user_id: user.id };
  const { data, error } = await supabase.from("tasks").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, patch: TaskUpdate): Promise<TaskRow> {
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function completeTask(id: string): Promise<TaskRow> {
  return updateTask(id, { status: "completed", completed_at: new Date().toISOString() });
}

export async function reopenTask(id: string): Promise<TaskRow> {
  return updateTask(id, { status: "pending", completed_at: null });
}

export async function waitTask(id: string): Promise<TaskRow> {
  return updateTask(id, { status: "waiting", completed_at: null });
}

export async function archiveTask(id: string): Promise<TaskRow> {
  return updateTask(id, { archived_at: new Date().toISOString() });
}

// ============================================================
// FOCO — cálculo de columnas a partir del estado real
// ============================================================

/**
 * Umbral (en días) sin `updated_at` reciente a partir del cual una
 * tarea `pending` se considera "sin movimiento".
 */
const SIN_MOVIMIENTO_DIAS = 7;

export interface FocusTasks {
  hoy: Tarea[];
  estaSemana: Tarea[];
  esperando: Tarea[];
  sinMovimiento: Tarea[];
}

type JoinedTaskRow = TaskRow & {
  subprojects:
    | {
        name: string;
        projects: {
          name: string;
          areas: { name: string; color: string | null } | null;
        } | null;
      }
    | null;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekLocal(d: Date): Date {
  // Semana ISO: lunes(1)..domingo(0). Fin = domingo 23:59:59.
  const x = startOfLocalDay(d);
  const dow = x.getDay(); // 0=domingo
  const diff = dow === 0 ? 0 : 7 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(23, 59, 59, 999);
  return x;
}

const SHORT_DOW_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function toTarea(row: JoinedTaskRow, categoria: CategoriaFoco): Tarea {
  const sub = row.subprojects;
  const proj = sub?.projects ?? null;
  const areaName = proj?.areas?.name ?? "";
  const projectName = proj?.name ?? undefined;
  const subName = sub?.name ?? undefined;

  const starts = row.starts_at ? new Date(row.starts_at) : null;
  const ends = row.ends_at ? new Date(row.ends_at) : null;
  const hasTime = !!starts && (starts.getHours() !== 0 || starts.getMinutes() !== 0);
  const horaInicio =
    hasTime && starts
      ? `${String(starts.getHours()).padStart(2, "0")}:${String(starts.getMinutes()).padStart(2, "0")}`
      : undefined;
  const horaFin = ends
    ? `${String(ends.getHours()).padStart(2, "0")}:${String(ends.getMinutes()).padStart(2, "0")}`
    : undefined;
  const fechaProgramada = starts
    ? `${starts.getFullYear()}-${String(starts.getMonth() + 1).padStart(2, "0")}-${String(starts.getDate()).padStart(2, "0")}`
    : undefined;

  // Duración: si es evento, se deriva de ends_at - starts_at; si no, se
  // toma la estimación manual del usuario.
  let duracionMin = row.estimated_duration_min ?? undefined;
  if (row.activity_type === "event" && starts && ends) {
    duracionMin = Math.max(1, Math.round((ends.getTime() - starts.getTime()) / 60000));
  }

  let diaEtiqueta: string | undefined;
  if (categoria === "esta_semana" && starts) {
    diaEtiqueta = `${SHORT_DOW_ES[starts.getDay()]} ${starts.getDate()}`;
  }

  const today = startOfLocalDay(new Date());
  const vencida =
    categoria === "hoy" && !!starts && startOfLocalDay(starts).getTime() < today.getTime();

  const diasSinActividad =
    categoria === "sin_movimiento"
      ? Math.floor(
          (Date.now() - new Date(row.updated_at).getTime()) / (24 * 60 * 60 * 1000),
        )
      : undefined;

  return {
    id: row.id,
    titulo: row.title,
    area: areaName,
    proyecto: projectName,
    proyectoColor: proj?.areas?.color ?? null,
    subproyecto: subName,
    fechaProgramada,
    horaInicio,
    duracionMin: row.estimated_duration_min ?? undefined,
    diaEtiqueta,
    categoriaFoco: categoria,
    vencida: vencida || undefined,
    diasSinActividad,
    completada: row.status === "completed",
    priority: mapDbPriorityToUi(row.priority),
  };
}

/**
 * Obtiene todas las tareas activas del usuario y las agrupa en las
 * 4 columnas de FOCO. Las categorías se CALCULAN, no se almacenan.
 *
 * Reglas:
 * - HOY:            pending, con `starts_at` de hoy, MÁS todas las
 *                   pending vencidas (starts_at anterior a hoy).
 * - ESTA SEMANA:    pending, con `starts_at` entre mañana y el
 *                   final de la semana (domingo local incluido).
 * - ESPERANDO:      todas las tareas con status = 'waiting'.
 * - SIN MOVIMIENTO: pending sin fecha, o pending sin actividad
 *                   reciente (updated_at > SIN_MOVIMIENTO_DIAS)
 *                   que no encajen en HOY o ESTA SEMANA.
 */
export async function fetchFocusTasks(): Promise<FocusTasks> {
  // El `!inner` en cada nivel + `.is("<rel>.archived_at", null)` hace que
  // PostgREST excluya del resultado cualquier tarea cuyo Subproyecto,
  // Proyecto o Área esté archivado. Así, archivar un nodo organizacional
  // oculta automáticamente sus tareas en FOCO sin necesidad de tocarlas.
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, subprojects!inner(name, archived_at, projects!inner(name, archived_at, areas!inner(name, color, archived_at)))",
    )
    .is("archived_at", null)
    .is("subprojects.archived_at", null)
    .is("subprojects.projects.archived_at", null)
    .is("subprojects.projects.areas.archived_at", null)
    .neq("status", "completed")
    .order("starts_at", { ascending: true, nullsFirst: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as JoinedTaskRow[];

  const today = startOfLocalDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = endOfWeekLocal(today);
  const staleThreshold = today.getTime() - SIN_MOVIMIENTO_DIAS * 24 * 60 * 60 * 1000;

  const hoy: Tarea[] = [];
  const estaSemana: Tarea[] = [];
  const esperando: Tarea[] = [];
  const sinMovimiento: Tarea[] = [];

  for (const row of rows) {
    if (row.status === "waiting") {
      esperando.push(toTarea(row, "esperando"));
      continue;
    }
    // pending desde aquí
    const starts = row.starts_at ? new Date(row.starts_at) : null;
    if (starts) {
      const day = startOfLocalDay(starts).getTime();
      if (day <= today.getTime()) {
        hoy.push(toTarea(row, "hoy"));
        continue;
      }
      if (day >= tomorrow.getTime() && starts.getTime() <= endOfWeek.getTime()) {
        estaSemana.push(toTarea(row, "esta_semana"));
        continue;
      }
    }
    // Sin fecha, o programada más allá de esta semana pero sin actividad reciente.
    const updatedMs = new Date(row.updated_at).getTime();
    if (!starts && updatedMs <= staleThreshold) {
      sinMovimiento.push(toTarea(row, "sin_movimiento"));
    } else if (!starts) {
      // pending sin fecha y con actividad reciente: la dejamos en sin_movimiento
      // igualmente para que el usuario no la pierda de vista.
      sinMovimiento.push(toTarea(row, "sin_movimiento"));
    }
    // pending programada más allá de esta semana: aún no aparece en FOCO
    // (se muestra en Calendar, que ya lee desde Supabase).

  }

  return { hoy, estaSemana, esperando, sinMovimiento };
}

// ============================================================
// CALENDAR — tareas programadas (con `starts_at`)
// ============================================================

/**
 * Mapea una fila `tasks` (con joins de subproject → project → area)
 * al tipo `Tarea` usado por la UI, en modo "programada".
 *
 * A diferencia de `toTarea()`, este mapeo NO calcula `categoriaFoco`,
 * `diaEtiqueta`, `vencida` ni `diasSinActividad`: esas dimensiones
 * pertenecen al dominio FOCO. Calendar sólo necesita título, área,
 * jerarquía, fecha/hora, duración, estado de completado y prioridad.
 *
 * `categoriaFoco` se mantiene por compatibilidad de tipo con `Tarea`
 * pero no debe ser interpretado por consumidores del Calendar.
 */
function rowToScheduledTarea(row: JoinedTaskRow): Tarea {
  const sub = row.subprojects;
  const proj = sub?.projects ?? null;
  const starts = row.starts_at ? new Date(row.starts_at) : null;
  const hasTime =
    !!starts && (starts.getHours() !== 0 || starts.getMinutes() !== 0);
  const horaInicio =
    hasTime && starts
      ? `${String(starts.getHours()).padStart(2, "0")}:${String(starts.getMinutes()).padStart(2, "0")}`
      : undefined;
  const fechaProgramada = starts
    ? `${starts.getFullYear()}-${String(starts.getMonth() + 1).padStart(2, "0")}-${String(starts.getDate()).padStart(2, "0")}`
    : undefined;

  return {
    id: row.id,
    titulo: row.title,
    area: proj?.areas?.name ?? "",
    proyecto: proj?.name ?? undefined,
    proyectoColor: proj?.areas?.color ?? null,
    subproyecto: sub?.name ?? undefined,
    fechaProgramada,
    horaInicio,
    duracionMin: row.estimated_duration_min ?? undefined,
    // Placeholder: Calendar no interpreta esta categoría; se conserva
    // sólo porque `Tarea` la exige. No confiar en este valor.
    categoriaFoco: "hoy",
    completada: row.status === "completed",
    priority: mapDbPriorityToUi(row.priority),
  };
}

/**
 * Devuelve todas las tareas del usuario que tienen `starts_at`
 * definido y no están archivadas. Es la única fuente de datos
 * del módulo Calendar.
 *
 * Reglas:
 * - Sólo entran tareas con `starts_at IS NOT NULL`. Las tareas
 *   sin fecha NO aparecen en Calendar (ver ARCHITECTURE.md).
 * - Incluye completadas y en espera: Calendar refleja el estado
 *   real de Supabase; la UI decide cómo mostrarlas.
 * - No aplica filtrado por rango: eso vive en `calendarService`,
 *   que es quien conoce la vista visible.
 */
export async function fetchScheduledTasks(): Promise<Tarea[]> {
  // Ver `fetchFocusTasks`: los `!inner` + filtros `.is(..., null)` en cada
  // nivel garantizan que las tareas cuyo Subproyecto/Proyecto/Área esté
  // archivado dejen de aparecer automáticamente en Calendar.
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, subprojects!inner(name, archived_at, projects!inner(name, archived_at, areas!inner(name, color, archived_at)))",
    )
    .is("archived_at", null)
    .is("subprojects.archived_at", null)
    .is("subprojects.projects.archived_at", null)
    .is("subprojects.projects.areas.archived_at", null)
    .not("starts_at", "is", null)
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as JoinedTaskRow[];
  return rows.map(rowToScheduledTarea);
}

