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
