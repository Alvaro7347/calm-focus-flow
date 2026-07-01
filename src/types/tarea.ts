export type CategoriaFoco = "hoy" | "esta_semana" | "esperando" | "sin_movimiento";

/**
 * Prioridad de una tarea. Atributo transversal del modelo:
 * lo consumirán FOCO, Calendar, Tablero y flujos futuros.
 * En esta iteración sólo vive en el modelo, sin impacto en UI.
 */
export type Priority = "alta" | "media" | "baja" | "normal";

/**
 * Regla de recurrencia (placeholder para futuras iteraciones).
 * La UI del calendario todavía no la interpreta, pero la estructura
 * queda lista para soportar recurrencias sin cambiar el tipo `Tarea`.
 */
export interface RecurrenceRule {
  frecuencia: "diaria" | "semanal" | "mensual" | "anual";
  intervalo?: number;
  hasta?: string; // ISO
  diasSemana?: number[]; // 0..6
}

export interface Tarea {
  id: string;
  titulo: string;
  area: string;
  proyecto?: string;
  subproyecto?: string;
  /** ISO date (YYYY-MM-DD). Si existe, la tarea aparece en Calendar. */
  fechaProgramada?: string;
  /** HH:mm. Si no existe pero hay fecha, la tarea es "Todo el día". */
  horaInicio?: string;
  /** Duración estimada en minutos (para el bloque en vista Semana). */
  duracionMin?: number;
  diaEtiqueta?: string; // e.g. "Mié 2" for esta_semana
  categoriaFoco: CategoriaFoco;
  vencida?: boolean;
  diasSinActividad?: number;
  completada?: boolean;
  recurrencia?: RecurrenceRule;
  /** Prioridad de la tarea. Si no se define, se asume "normal". */
  priority?: Priority;
}

export interface Area {
  nombre: string;
  color: string; // tailwind bg-* class for the dot
  count: number;
}
