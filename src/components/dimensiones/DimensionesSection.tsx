/**
 * ========================================================
 * Archivo: dimensionService — Dimensiones
 *
 * Dimensión = subdivisión permanente dentro de un Área
 * (p. ej. "Ventas", "Salud"). Puede contener Proyectos,
 * Objetivos, Hábitos y Tareas directas.
 *
 * Reglas:
 *  - Pertenece a UNA Área (la base de datos impide mezclar Áreas).
 *  - Es opcional: lo existente sigue funcionando sin Dimensión.
 *  - CalmApp nunca crea Dimensiones por su cuenta: sólo el usuario.
 *  - No se borra: se archiva. Si tiene elementos, el usuario decide
 *    en el momento: mantenerla o mover sus elementos a
 *    "Sin dimensión" y archivarla. Nunca se pierde información.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DimensionRow = Database["public"]["Tables"]["dimensions"]["Row"];

export interface DimensionContents {
  projects: number;
  objectives: number;
  habits: number;
  tasks: number;
  total: number;
}

/** Dimensiones activas de un Área, en orden. */
export async function fetchDimensions(areaId: string): Promise<DimensionRow[]> {
  const { data, error } = await supabase
    .from("dimensions")
    .select("*")
    .eq("area_id", areaId)
    .is("archived_at", null)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createDimension(areaId: string, name: string): Promise<DimensionRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío.");
  const { data: existing } = await supabase
    .from("dimensions")
    .select("display_order")
    .eq("area_id", areaId)
    .is("archived_at", null)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("dimensions")
    .insert({ area_id: areaId, name: trimmed, display_order: nextOrder })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error("Ya existe una dimensión con ese nombre en esta área.");
    throw error;
  }
  return data;
}

export async function renameDimension(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío.");
  const { error } = await supabase.from("dimensions").update({ name: trimmed }).eq("id", id);
  if (error) {
    if (error.code === "23505")
      throw new Error("Ya existe una dimensión con ese nombre en esta área.");
    throw error;
  }
}

/** Cuántos elementos activos contiene una Dimensión. */
export async function countDimensionContents(id: string): Promise<DimensionContents> {
  const count = async (table: "projects" | "objectives" | "habits" | "tasks") => {
    const { count: n, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("dimension_id", id)
      .is("archived_at", null);
    if (error) throw error;
    return n ?? 0;
  };
  const [projects, objectives, habits, tasks] = await Promise.all([
    count("projects"),
    count("objectives"),
    count("habits"),
    count("tasks"),
  ]);
  return { projects, objectives, habits, tasks, total: projects + objectives + habits + tasks };
}

/**
 * Archiva una Dimensión. Antes desvincula TODOS sus elementos
 * (incluidos los archivados), que quedan en "Sin dimensión" del Área.
 * Nada se elimina.
 */
export async function archiveDimensionMovingContents(id: string): Promise<void> {
  for (const table of ["projects", "objectives", "habits", "tasks"] as const) {
    const { error } = await supabase
      .from(table)
      .update({ dimension_id: null })
      .eq("dimension_id", id);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("dimensions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Asigna (o quita, con null) la Dimensión de un Proyecto, Objetivo o Hábito. */
export async function setElementDimension(
  table: "projects" | "objectives" | "habits",
  id: string,
  dimensionId: string | null,
): Promise<void> {
  const { error } = await supabase.from(table).update({ dimension_id: dimensionId }).eq("id", id);
  if (error) throw error;
}
