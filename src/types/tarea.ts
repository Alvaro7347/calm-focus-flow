export type CategoriaFoco = "hoy" | "esta_semana" | "esperando" | "sin_movimiento";

export interface Tarea {
  id: string;
  titulo: string;
  area: string;
  proyecto?: string;
  subproyecto?: string;
  fechaProgramada?: string;
  horaInicio?: string;
  diaEtiqueta?: string; // e.g. "Mié 2" for esta_semana
  categoriaFoco: CategoriaFoco;
  vencida?: boolean;
  diasSinActividad?: number;
}

export interface Area {
  nombre: string;
  color: string; // tailwind bg-* class for the dot
  count: number;
}
