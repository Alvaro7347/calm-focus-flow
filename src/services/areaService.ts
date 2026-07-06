/**
 * ========================================================
 * Archivo: areaService
 *
 * Responsabilidad:
 * Provee la lista de Áreas visibles en la aplicación y expone
 * la capa de acceso a la tabla `public.areas` de Supabase.
 *
 * Estado de migración:
 * - `fetchAreas()`, `fetchAreasWithCounts()`, `createArea()`,
 *   `updateArea()`, `archiveArea()` (ASÍNCRONOS) son la API oficial
 *   contra Supabase y las consumen Crear tarea, FOCO, Calendar,
 *   Tablero y el shell de navegación (Sidebar, AreasDrawer vía el
 *   hook `useAreasNav`).
 * - No existe API síncrona: la migración a Supabase está completa
 *   y toda la aplicación pasa por Supabase.
 *
 * Reglas del dominio (definidas en la migración):
 * - Cada Área pertenece a un `user_id` (FK → profiles.id).
 * - Nombre único por usuario (case-insensitive).
 * - `archived_at` marca el archivado; NO se eliminan físicamente.
 * - `display_order` habilita ordenamiento manual (drag & drop futuro).
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Area, AreaRow, AreaInsert, AreaUpdate } from "@/types/tarea";
import { getProjectColor } from "@/lib/projectIdentity";

/**
 * Colores estables de respaldo para las Áreas conocidas del proyecto.
 * Se aplican SÓLO cuando el Área todavía no tiene `color` (slug de la
 * paleta CalmApp) asignado desde el Centro de Gestión de Organización.
 * Una vez que el usuario elige color desde Ajustes → Organización,
 * ese valor manda y este mapa deja de aplicar para esa Área.
 */
const AREA_COLORS: Record<string, string> = {
  Soundkeleles: "bg-violet-500",
  UNAB: "bg-blue-500",
  Panadería: "bg-orange-500",
  Fundación: "bg-green-500",
  Familia: "bg-pink-400",
  "Finanzas personales": "bg-teal-500",
  Salud: "bg-cyan-500",
  "Desarrollo personal": "bg-amber-400",
  UTEM: "bg-violet-300",
};

const FALLBACK_PALETTE = [
  "bg-slate-400",
  "bg-emerald-500",
  "bg-rose-400",
  "bg-sky-500",
  "bg-fuchsia-400",
  "bg-lime-500",
];

function fallbackColorFor(nombre: string): string {
  if (AREA_COLORS[nombre]) return AREA_COLORS[nombre];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

/**
 * Devuelve la clase Tailwind del punto de color visible en Sidebar/AreasDrawer.
 * Prioridad:
 *  1) `row.color` (slug elegido por el usuario en Ajustes → Organización).
 *  2) Color estable por nombre conocido o hash del nombre.
 */
function areaDotClass(row: AreaRow): string {
  if (row.color) return getProjectColor(row.color).dot;
  return fallbackColorFor(row.name);
}

// ============================================================
// API asíncrona sobre Supabase (MVP1)
// ============================================================

/** Lista las Áreas no archivadas del usuario autenticado, ordenadas por `display_order`. */
export async function fetchAreas(includeArchived = false): Promise<AreaRow[]> {
  let query = supabase
    .from("areas")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AreaRow[];
}


/**
 * Devuelve las Áreas activas del usuario autenticado con su
 * contador de tareas NO archivadas, en el shape de UI (`Area`).
 * Fuente de verdad para el shell de navegación (Sidebar, AreasDrawer)
 * a través del hook `useAreasNav`. Consulta exclusivamente Supabase.
 */
export async function fetchAreasWithCounts(): Promise<Area[]> {
  const rows = await fetchAreas(false);

  // Contamos tareas activas cuya cadena Subproyecto → Proyecto → Área no
  // esté archivada. Con `!inner` + `.is("<rel>.archived_at", null)` PostgREST
  // descarta las tareas colgadas de ramas archivadas.
  const { data: taskRows, error } = await supabase
    .from("tasks")
    .select("subprojects!inner(archived_at, projects!inner(area_id, archived_at, areas!inner(archived_at)))")
    .is("archived_at", null)
    .is("subprojects.archived_at", null)
    .is("subprojects.projects.archived_at", null)
    .is("subprojects.projects.areas.archived_at", null);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const t of (taskRows ?? []) as Array<{ subprojects: { projects: { area_id: string | null } } }>) {
    const areaId = t.subprojects?.projects?.area_id;
    if (!areaId) continue;
    counts.set(areaId, (counts.get(areaId) ?? 0) + 1);
  }

  return rows.map((r) => ({
    nombre: r.name,
    color: areaDotClass(r),
    count: counts.get(r.id) ?? 0,
  }));
}

export async function fetchAreaById(id: string): Promise<AreaRow | null> {
  const { data, error } = await supabase.from("areas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as AreaRow | null) ?? null;
}

export async function createArea(input: Omit<AreaInsert, "user_id">): Promise<AreaRow> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("No hay usuario autenticado");

  const payload: AreaInsert = { ...input, user_id: user.id };
  const { data, error } = await supabase
    .from("areas")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as AreaRow;
}

export async function updateArea(id: string, patch: AreaUpdate): Promise<AreaRow> {
  const { data, error } = await supabase
    .from("areas")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as AreaRow;
}

/**
 * Marca un Área como archivada. NO elimina físicamente.
 *
 * La propagación a Proyectos, Subproyectos y Tareas no requiere una
 * mutación en cascada: `tableroService.fetchAreaTree`, `fetchFocusTasks`,
 * `fetchScheduledTasks` y `fetchAreasWithCounts` filtran por
 * `archived_at IS NULL` en cada nivel de la jerarquía, así que al
 * archivar el Área todo su subárbol y sus tareas dejan de aparecer
 * automáticamente en Sidebar, FOCO, Calendario y Tablero.
 */
export async function archiveArea(id: string): Promise<AreaRow> {
  return updateArea(id, { archived_at: new Date().toISOString() });
}

export async function unarchiveArea(id: string): Promise<AreaRow> {
  return updateArea(id, { archived_at: null });
}

