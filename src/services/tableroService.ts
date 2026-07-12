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
import type { Tarea } from "@/types/tarea";

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
}

export interface AreaNode {
  id: string;
  nombre: string;
  slug: string;
  /** Slug de la paleta CalmApp. Puede ser `null` (usa color por defecto). */
  color: string | null;
  proyectos: ProyectoNode[];
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
  tasks: RawTask[] | null;
};

type RawProject = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  subprojects: RawSubproject[] | null;
};

type RawArea = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
  color: string | null;
  projects: RawProject[] | null;
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
         subprojects (
           id, name, display_order, archived_at,
           tasks (
             id, title, status, priority, starts_at,
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
            const tareas = (s.tasks ?? [])
              .filter((t) => t.archived_at === null)
              .map((t) => mapTask(t, a.name, p.name, areaColor, s.name));
            return {
              id: s.id,
              nombre: s.name,
              slug: slugify(s.name),
              tareas,
            };
          });
        const totalTareas = subproyectos.reduce((n, s) => n + s.tareas.length, 0);
        return {
          id: p.id,
          nombre: p.name,
          slug: slugify(p.name),
          color: areaColor,
          subproyectos,
          totalTareas,
        };
      });
    const totalTareas = proyectos.reduce((n, p) => n + p.totalTareas, 0);
    return {
      id: a.id,
      nombre: a.name,
      slug: slugify(a.name),
      color: areaColor,
      proyectos,
      totalTareas,
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
