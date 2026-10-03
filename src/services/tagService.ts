/**
 * ========================================================
 * Archivo: tagService — Etiquetas
 *
 * Etiquetas libres del usuario ("Instagram", "Contenido",
 * "Análisis"…) para cruzar y medir el trabajo sin agregar
 * niveles al árbol. Una tarea puede tener varias.
 *
 *  - Son del usuario: sirven en cualquier Área o Dimensión.
 *  - Se archivan, no se borran (las asignaciones quedan como
 *    historial).
 *  - Tolerante: si la migración de etiquetas aún no está
 *    aplicada, las lecturas devuelven vacío y la app sigue igual.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TagRow = Database["public"]["Tables"]["tags"]["Row"];

/** Etiquetas activas, por nombre. */
export async function fetchTags(): Promise<TagRow[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function createTag(name: string): Promise<TagRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío.");
  const { data, error } = await supabase
    .from("tags")
    .insert({ name: trimmed })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya tienes una etiqueta con ese nombre.");
    throw error;
  }
  return data;
}

export async function renameTag(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío.");
  const { error } = await supabase.from("tags").update({ name: trimmed }).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Ya tienes una etiqueta con ese nombre.");
    throw error;
  }
}

/** Archiva una etiqueta: deja de ofrecerse; sus asignaciones se conservan. */
export async function archiveTag(id: string): Promise<void> {
  const { error } = await supabase
    .from("tags")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Cuántas actividades usan cada etiqueta (para la pantalla de gestión). */
export async function fetchTagUsage(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("task_tags").select("tag_id");
  if (error) return {};
  const usage: Record<string, number> = {};
  for (const r of data ?? []) usage[r.tag_id] = (usage[r.tag_id] ?? 0) + 1;
  return usage;
}

/** IDs de etiquetas de una actividad. */
export async function fetchTaskTagIds(taskId: string): Promise<string[]> {
  const { data, error } = await supabase.from("task_tags").select("tag_id").eq("task_id", taskId);
  if (error) return [];
  return (data ?? []).map((r) => r.tag_id);
}

/**
 * Mapa actividad → IDs de etiquetas, para mostrar chips en listas
 * sin tocar las consultas existentes.
 */
export async function fetchAllTaskTags(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.from("task_tags").select("task_id, tag_id");
  if (error) return {};
  const map: Record<string, string[]> = {};
  for (const r of data ?? []) (map[r.task_id] ??= []).push(r.tag_id);
  return map;
}

/** Reemplaza las etiquetas de una actividad por `tagIds`. */
export async function setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
  const current = await fetchTaskTagIds(taskId);
  const toAdd = tagIds.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !tagIds.includes(id));
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("task_tags")
      .delete()
      .eq("task_id", taskId)
      .in("tag_id", toRemove);
    if (error) throw error;
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("task_tags")
      .insert(toAdd.map((tag_id) => ({ task_id: taskId, tag_id })));
    if (error) throw error;
  }
}
