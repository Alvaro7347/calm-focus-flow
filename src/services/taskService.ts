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
 * Utilizado por:
 * - focusService (arma las 4 columnas de FOCO)
 * - calendarService (transforma tareas en eventos)
 * - Futuras pantallas: Crear tarea, Tablero, etc.
 *
 * En el MVP1 la implementación pasará a leer desde Supabase.
 * La interfaz pública (getAllTasks, getTasksByFocusCategory,
 * getTaskById) debe mantenerse estable para que ningún
 * consumidor requiera cambios.
 * ========================================================
 */
import { tareasFoco } from "@/data/mockTasks";
import type { CategoriaFoco, Tarea } from "@/types/tarea";

export function getAllTasks(): Tarea[] {
  return tareasFoco;
}

export function getTasksByFocusCategory(categoria: CategoriaFoco): Tarea[] {
  return tareasFoco.filter((t) => t.categoriaFoco === categoria);
}

export function getTaskById(id: string): Tarea | undefined {
  return tareasFoco.find((t) => t.id === id);
}
