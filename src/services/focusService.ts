/**
 * ========================================================
 * Archivo: focusService
 *
 * Responsabilidad:
 * Centraliza toda la lógica utilizada por la pantalla FOCO,
 * incluyendo el filtrado de tareas por categoría (hoy,
 * esta semana, esperando, sin movimiento).
 *
 * Utilizado por:
 * - FocoPage (src/routes/foco.tsx)
 *
 * No debe ser utilizado directamente por componentes visuales
 * (tarjetas, columnas, layout). Esos consumen los datos ya
 * preparados a través de la pantalla contenedora.
 *
 * Actualmente utiliza datos mock desde src/data/mockFocus.ts.
 * En el MVP1 esta será la capa que conectará con Supabase,
 * sin que las pantallas necesiten cambios.
 * ========================================================
 */
import { tareasFoco } from "@/data/mockFocus";
import type { Tarea } from "@/types/tarea";

export interface FocusTasks {
  hoy: Tarea[];
  estaSemana: Tarea[];
  esperando: Tarea[];
  sinMovimiento: Tarea[];
}

export function getFocusTasks(): FocusTasks {
  return {
    hoy: tareasFoco.filter((t) => t.categoriaFoco === "hoy"),
    estaSemana: tareasFoco.filter((t) => t.categoriaFoco === "esta_semana"),
    esperando: tareasFoco.filter((t) => t.categoriaFoco === "esperando"),
    sinMovimiento: tareasFoco.filter((t) => t.categoriaFoco === "sin_movimiento"),
  };
}
