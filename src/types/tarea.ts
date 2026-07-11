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

import type { ActivityType } from "./activity";
export type { ActivityType } from "./activity";

export interface Tarea {
  id: string;
  titulo: string;
  area: string;
  proyecto?: string;
  subproyecto?: string;
  /**
   * Slug de identidad visual del Proyecto padre (paleta CalmApp).
   * Puede ser `null`/`undefined`; los consumidores deben resolverlo
   * con `getProjectColor` para caer al color por defecto.
   */
  proyectoColor?: string | null;
  /** ISO date (YYYY-MM-DD). Si existe, la tarea aparece en Calendar. */
  fechaProgramada?: string;
  /** HH:mm. Si no existe pero hay fecha, la tarea es "Todo el día". */
  horaInicio?: string;
  /** Duración estimada en minutos (para el bloque en vista Semana). */
  duracionMin?: number;
  /**
   * Hora de fin (HH:mm) para eventos. Sólo se rellena cuando
   * `tipo === "evento"`. Los consumidores que la ignoren siguen
   * funcionando: la duración se recalcula a partir de `finISO`
   * cuando existe.
   */
  horaFin?: string;
  /** ISO completo del fin del evento (starts_at + horaFin). */
  finISO?: string;
  diaEtiqueta?: string; // e.g. "Mié 2" for esta_semana
  categoriaFoco: CategoriaFoco;
  vencida?: boolean;
  diasSinActividad?: number;
  completada?: boolean;
  recurrencia?: RecurrenceRule;
  /** Prioridad de la tarea. Si no se define, se asume "normal". */
  priority?: Priority;
  /**
   * Tipo de actividad. Discriminante de la union `Activity` (ver
   * `src/types/activity.ts`). Por compatibilidad hacia atrás se
   * expone como opcional; si falta, asumir `"tarea"`.
   */
  tipo?: ActivityType;
}

export interface Area {
  nombre: string;
  color: string; // tailwind bg-* class for the dot
  count: number;
}

// ============================================================
// Tipos derivados de Supabase (MVP1 — dominio organizacional)
// ============================================================
import type { Database } from "@/integrations/supabase/types";

export type AreaRow = Database["public"]["Tables"]["areas"]["Row"];
export type AreaInsert = Database["public"]["Tables"]["areas"]["Insert"];
export type AreaUpdate = Database["public"]["Tables"]["areas"]["Update"];

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export type SubprojectRow = Database["public"]["Tables"]["subprojects"]["Row"];
export type SubprojectInsert = Database["public"]["Tables"]["subprojects"]["Insert"];
export type SubprojectUpdate = Database["public"]["Tables"]["subprojects"]["Update"];
