/**
 * ========================================================
 * Modelo de dominio: Hábito
 *
 * Un **Hábito** vive directamente bajo un Área (no bajo Objetivo ni
 * Proyecto). Combina seguimiento operativo (frecuencia, ejecuciones,
 * % de cumplimiento) con una razón emocional para sostenerlo:
 *
 *   - reasonText: "¿Por qué quiero incorporar esto?"
 *   - desiredFutureText: "¿Qué futuro estoy construyendo? ¿Qué
 *     versión de mí quiero desarrollar mediante este hábito?"
 *
 * `frequencyRule` reutiliza la misma forma que `RecurrenceRule`
 * (src/types/tarea.ts) para no introducir un segundo formato de
 * recurrencia en la app.
 *
 * El % de cumplimiento (`completionPct`) NO se guarda en `habits`:
 * se calcula en el cliente a partir de `habit_logs` para la ventana
 * de tiempo que la UI necesite (ej. mensual), porque "cumplimiento"
 * depende del período consultado.
 * ========================================================
 */
import type { Database } from "@/integrations/supabase/types";
import type { RecurrenceRule } from "./tarea";

export type HabitRow = Database["public"]["Tables"]["habits"]["Row"];
export type HabitInsert = Database["public"]["Tables"]["habits"]["Insert"];
export type HabitUpdate = Database["public"]["Tables"]["habits"]["Update"];

export type HabitLogRow = Database["public"]["Tables"]["habit_logs"]["Row"];
export type HabitLogInsert = Database["public"]["Tables"]["habit_logs"]["Insert"];
export type HabitLogUpdate = Database["public"]["Tables"]["habit_logs"]["Update"];

/** Vista de dominio (camelCase) de un Hábito, sin sus ejecuciones. */
export interface Habito {
  id: string;
  areaId: string;
  nombre: string;
  razon?: string;
  futuroDeseado?: string;
  frecuencia: RecurrenceRule | null;
}

/** Una ejecución puntual de un Hábito en una fecha determinada. */
export interface EjecucionHabito {
  id: string;
  habitoId: string;
  fecha: string; // ISO date (YYYY-MM-DD)
  cumplida: boolean;
}

export function mapHabitRow(row: HabitRow): Habito {
  return {
    id: row.id,
    areaId: row.area_id,
    nombre: row.name,
    razon: row.reason_text ?? undefined,
    futuroDeseado: row.desired_future_text ?? undefined,
    frecuencia: (row.frequency_rule as unknown as RecurrenceRule) ?? null,
  };
}

export function mapHabitLogRow(row: HabitLogRow): EjecucionHabito {
  return {
    id: row.id,
    habitoId: row.habit_id,
    fecha: row.log_date,
    cumplida: row.done,
  };
}

/**
 * % de cumplimiento de un Hábito en un rango de fechas, respecto de
 * la cantidad de días esperados según su frecuencia.
 *
 * `expectedDaysInRange` debe calcularse aparte (a partir de
 * `frequencyRule` y el rango) porque depende de calendario real
 * (días de la semana, mes, etc.) — no es responsabilidad de este tipo.
 */
export function calcularCumplimiento(
  logs: EjecucionHabito[],
  expectedDaysInRange: number,
): number {
  if (expectedDaysInRange <= 0) return 0;
  const cumplidos = logs.filter((l) => l.cumplida).length;
  return Math.round((cumplidos / expectedDaysInRange) * 100);
}
