/**
 * ========================================================
 * Archivo: areaService
 *
 * Responsabilidad:
 * Provee la lista de áreas de la aplicación (Soundkeleles,
 * Panadería, UNAB, Familia, etc.) que se muestran en el
 * sidebar desktop y en el drawer mobile.
 *
 * Utilizado por:
 * - Sidebar (desktop)
 * - AreasDrawer (mobile)
 *
 * No debe ser utilizado por componentes que no representen
 * navegación por áreas, ni por servicios de tareas.
 *
 * Actualmente utiliza datos mock desde src/data/areas.ts.
 * En el MVP1 esta capa conectará con Supabase para leer
 * las áreas del usuario autenticado.
 * ========================================================
 */
import { areas } from "@/data/areas";
import type { Area } from "@/types/tarea";

export function getAreas(): Area[] {
  return areas;
}
