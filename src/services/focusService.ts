/**
 * ========================================================
 * Archivo: focusService
 *
 * Responsabilidad:
 * Prepara los datos para la pantalla FOCO agrupando las
 * tareas en sus 4 categorías. Consume taskService — nunca
 * accede al mock ni a Supabase directamente.
 *
 * Utilizado por:
 * - FocoPage (src/routes/foco.tsx)
 * ========================================================
 */
import { getTasksByFocusCategory } from "@/services/taskService";
import type { Tarea } from "@/types/tarea";

export interface FocusTasks {
  hoy: Tarea[];
  estaSemana: Tarea[];
  esperando: Tarea[];
  sinMovimiento: Tarea[];
}

export function getFocusTasks(): FocusTasks {
  return {
    hoy: getTasksByFocusCategory("hoy"),
    estaSemana: getTasksByFocusCategory("esta_semana"),
    esperando: getTasksByFocusCategory("esperando"),
    sinMovimiento: getTasksByFocusCategory("sin_movimiento"),
  };
}
