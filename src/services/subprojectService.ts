/**
 * ========================================================
 * Archivo: subprojectService
 *
 * Responsabilidad:
 * Capa de acceso a la tabla `public.subprojects` de Supabase.
 *
 * Reglas del dominio:
 * - Cada Subproyecto pertenece obligatoriamente a un Proyecto (FK).
 * - Nombre único dentro del mismo Proyecto (case-insensitive).
 * - Los Subproyectos NO tienen descripción (decisión de producto).
 * - Se archiva con `archived_at`; nunca se elimina físicamente.
 * - `display_order` habilita ordenamiento manual futuro.
 *
 * Este servicio es infraestructura MVP1; aún no lo consume ninguna
 * pantalla. El Tablero seguirá funcionando con mocks hasta que
 * `taskService` migre a Supabase.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  SubprojectRow,
  SubprojectInsert,
  SubprojectUpdate,
} from "@/types/tarea";

export async function fetchSubprojects(
  projectId?: string,
  includeArchived = false,
): Promise<SubprojectRow[]> {
  let query = supabase
    .from("subprojects")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (projectId) query = query.eq("project_id", projectId);
  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SubprojectRow[];
}

export async function fetchSubprojectById(id: string): Promise<SubprojectRow | null> {
  const { data, error } = await supabase
    .from("subprojects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SubprojectRow | null) ?? null;
}

export async function createSubproject(input: SubprojectInsert): Promise<SubprojectRow> {
  const { data, error } = await supabase
    .from("subprojects")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as SubprojectRow;
}

export async function updateSubproject(
  id: string,
  patch: SubprojectUpdate,
): Promise<SubprojectRow> {
  const { data, error } = await supabase
    .from("subprojects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as SubprojectRow;
}

export async function archiveSubproject(id: string): Promise<SubprojectRow> {
  return updateSubproject(id, { archived_at: new Date().toISOString() });
}

export async function unarchiveSubproject(id: string): Promise<SubprojectRow> {
  return updateSubproject(id, { archived_at: null });
}
