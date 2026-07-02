/**
 * ========================================================
 * Archivo: taskService
 *
 * Responsabilidad:
 * Única fuente de verdad para el acceso a tareas en toda la
 * aplicación. Cualquier pantalla o servicio que necesite
 * tareas debe pasar por aquí — nunca importar mocks
 * directamente ni conocer el origen de los datos.
 *
 * Estrategia MVP0 → MVP2 (arquitectura híbrida):
 * - API síncrona (getAllTasks, getTasksByFocusCategory,
 *   getTaskById): sigue leyendo desde el mock local para
 *   mantener intactos FOCO, Calendar y Tablero mientras la
 *   UI no ha migrado. Es temporal.
 * - API asíncrona (fetchTasks, fetchTaskById, createTask,
 *   updateTask, completeTask, archiveTask): consulta y
 *   escribe en la tabla `tasks` de Supabase. Es la fuente
 *   oficial que se usará al construir "Crear tarea" y las
 *   siguientes pantallas.
 *
 * Reglas de dominio (ver ARCHITECTURE.md):
 * - Toda tarea pertenece obligatoriamente a un usuario y a
 *   un subproyecto. Área y Proyecto se derivan por relación
 *   subprojects → projects → areas; jamás se guardan en
 *   `tasks`.
 * - No existe eliminación física: usar archiveTask() que
 *   escribe `archived_at`.
 * - Estados válidos: 'pending' | 'completed'. `completed_at`
 *   se sincroniza con el estado por CHECK constraint.
 * ========================================================
 */
import { tareasFoco } from "@/data/mockTasks";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CategoriaFoco, Tarea } from "@/types/tarea";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskSource = Database["public"]["Enums"]["task_source"];

// ---------- API síncrona (mock, temporal) ----------

export function getAllTasks(): Tarea[] {
  return tareasFoco;
}

export function getTasksByFocusCategory(categoria: CategoriaFoco): Tarea[] {
  return tareasFoco.filter((t) => t.categoriaFoco === categoria);
}

export function getTaskById(id: string): Tarea | undefined {
  return tareasFoco.find((t) => t.id === id);
}

// ---------- API asíncrona (Supabase, oficial) ----------

export interface FetchTasksOptions {
  includeArchived?: boolean;
  status?: TaskStatus;
  subprojectId?: string;
}

export async function fetchTasks(options: FetchTasksOptions = {}): Promise<TaskRow[]> {
  let query = supabase.from("tasks").select("*");

  if (!options.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (options.subprojectId) {
    query = query.eq("subproject_id", options.subprojectId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTaskById(id: string): Promise<TaskRow | null> {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTask(input: TaskInsert): Promise<TaskRow> {
  const { data, error } = await supabase.from("tasks").insert(input).select("*").single();
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

export async function archiveTask(id: string): Promise<TaskRow> {
  return updateTask(id, { archived_at: new Date().toISOString() });
}
