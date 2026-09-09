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
import type { Tarea, ProgressMode } from "@/types/tarea";

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
  /** Suma de `tareasPendientes` de sus proyectos. */
  totalTareas: number;
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
  goals: RawGoal[] | null;
};

type RawArea = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  color: string | null;
  projects: RawProject[] | null;
  objectives: RawObjective[] | null;
};

function isoDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const { data, error } = await supabase
    .from("areas")
    .select(
      `id, name, display_order, archived_at, color,
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
       )`,
    )
    .is("archived_at", null)
    .order("display_order", { ascending: true });

  if (error) throw error;

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
        };
      });

    return {
      id: a.id,
      nombre: a.name,
      slug: slugify(a.name),
      color: areaColor,
      proyectos,
      objetivos,
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
