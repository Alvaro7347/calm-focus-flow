/**
 * ========================================================
 * Archivo: projectService
 *
 * Responsabilidad:
 * Capa de acceso a la tabla `public.projects` de Supabase.
 *
 * Reglas del dominio:
 * - Cada Proyecto pertenece obligatoriamente a un Área (FK).
 * - Nombre único dentro de la misma Área (case-insensitive).
 * - Se archiva con `archived_at`; nunca se elimina físicamente.
 * - `display_order` habilita ordenamiento manual futuro.
 *
 * Ya se consume desde Crear tarea (selector en cascada). El
 * Tablero sigue derivando su árbol desde tareas mock vía
 * `tableroService` y es el último módulo pendiente de migrar
 * a Supabase.

 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProjectRow, ProjectInsert, ProjectUpdate } from "@/types/tarea";

export async function fetchProjects(
  areaId?: string,
  includeArchived = false,
): Promise<ProjectRow[]> {
  let query = supabase
    .from("projects")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (areaId) query = query.eq("area_id", areaId);
  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

export async function fetchProjectById(id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectRow | null) ?? null;
}

export async function createProject(input: ProjectInsert): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("projects")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function updateProject(id: string, patch: ProjectUpdate): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

/**
 * Marca el Proyecto como archivado. La propagación a Subproyectos
 * hijos se hará en una capa de aplicación posterior (ver DECISIONS.md).
 */
export async function archiveProject(id: string): Promise<ProjectRow> {
  return updateProject(id, { archived_at: new Date().toISOString() });
}

export async function unarchiveProject(id: string): Promise<ProjectRow> {
  return updateProject(id, { archived_at: null });
}
