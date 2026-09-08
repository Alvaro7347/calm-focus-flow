/**
 * ========================================================
 * Modelo de dominio: Objetivo y Meta
 *
 * Un **Objetivo** representa una situación futura deseada dentro de
 * un Área. No existe como una frase suelta: siempre se construye
 * mediante **Metas** (el "camino"), cada una con fecha y progreso.
 *
 * Jerarquía:
 *   Área → Objetivo → Meta → Tareas
 *
 * Dimensión emocional (`visionText` / `visionImageUrl`): representa
 * la situación futura deseada — cómo sería la vida del usuario, qué
 * sentiría, qué cambiaría. Vive tanto en Objetivo como en Meta
 * (opcional en esta última).
 *
 * Progreso mixto: `progressMode` = 'auto' (recalculado desde los
 * hijos) o 'manual' (fijado a mano por el usuario). Ver
 * `recalc_objective_progress` / `recalc_goal_progress` en la
 * migración de base de datos.
 * ========================================================
 */
import type { Database } from "@/integrations/supabase/types";
import type { ProgressMode } from "./tarea";

export type ObjectiveRow = Database["public"]["Tables"]["objectives"]["Row"];
export type ObjectiveInsert = Database["public"]["Tables"]["objectives"]["Insert"];
export type ObjectiveUpdate = Database["public"]["Tables"]["objectives"]["Update"];

export type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
export type GoalInsert = Database["public"]["Tables"]["goals"]["Insert"];
export type GoalUpdate = Database["public"]["Tables"]["goals"]["Update"];

/**
 * Vista de dominio (camelCase) de un Objetivo, con sus Metas ya
 * resueltas. Se arma en `objectiveService` a partir de `ObjectiveRow`
 * + `GoalRow[]`; no es la forma cruda de Supabase.
 */
export interface Objetivo {
  id: string;
  areaId: string;
  nombre: string;
  fechaFinal?: string; // ISO date (YYYY-MM-DD)
  progreso: number; // 0-100
  modoProgreso: ProgressMode;
  visionTexto?: string;
  visionImagenUrl?: string;
  metas: Meta[];
}

export interface Meta {
  id: string;
  objetivoId: string;
  nombre: string;
  fecha?: string; // ISO date (YYYY-MM-DD)
  progreso: number; // 0-100
  modoProgreso: ProgressMode;
  visionTexto?: string;
  visionImagenUrl?: string;
}

export function mapObjectiveRow(row: ObjectiveRow, metas: Meta[] = []): Objetivo {
  return {
    id: row.id,
    areaId: row.area_id,
    nombre: row.name,
    fechaFinal: row.target_date ?? undefined,
    progreso: row.progress_pct,
    modoProgreso: row.progress_mode,
    visionTexto: row.vision_text ?? undefined,
    visionImagenUrl: row.vision_image_url ?? undefined,
    metas,
  };
}

export function mapGoalRow(row: GoalRow): Meta {
  return {
    id: row.id,
    objetivoId: row.objective_id,
    nombre: row.name,
    fecha: row.target_date ?? undefined,
    progreso: row.progress_pct,
    modoProgreso: row.progress_mode,
    visionTexto: row.vision_text ?? undefined,
    visionImagenUrl: row.vision_image_url ?? undefined,
  };
}
