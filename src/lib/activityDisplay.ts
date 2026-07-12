/**
 * ========================================================
 * Helper: activityDisplay
 *
 * Utilidades compartidas por las vistas del Calendario (Día,
 * Semana, Mes y detalle) para diferenciar visualmente Tareas
 * de Eventos manteniendo la estética actual.
 *
 * Fuente de verdad: `activity_type` (mapeado a `tipo` en el
 * dominio). Nunca se infiere el tipo por la presencia de
 * `ends_at`, la duración o el título.
 *
 * Este módulo NO produce estilos: sólo textos y flags.
 * Los estilos siguen viviendo en cada vista para adaptarse
 * al espacio disponible (Día = holgado, Semana = compacto,
 * Mes = mínimo).
 * ========================================================
 */
import { format } from "date-fns";
import type { CalendarEvent } from "@/services/calendarService";
import type { ActivityType } from "@/types/activity";

/**
 * Tipo efectivo de la actividad. Preserva el contrato: si el
 * dato aún no tiene `tipo` cargado (compat), se asume "tarea".
 */
export function activityType(e: CalendarEvent): ActivityType {
  return e.tarea?.tipo === "evento" ? "evento" : "tarea";
}

export function isEvento(e: CalendarEvent): boolean {
  return activityType(e) === "evento";
}

/**
 * Texto de horario para una Tarea (flexible):
 *
 *   - hora + duración → "Sugerida 10:10 · 30 min"
 *   - sólo hora       → "Sugerida 10:10"
 *   - sólo duración   → "Duración estimada: 30 min"
 *   - nada            → null (no inventar información)
 *
 * `allDay` se maneja por separado en la UI.
 */
export function taskScheduleText(e: CalendarEvent): string | null {
  if (e.allDay) return null;
  const t = e.tarea;
  const hora = t?.horaInicio ?? (e.start ? format(e.start, "HH:mm") : undefined);
  const dur = t?.duracionMin;
  if (hora && dur) return `Sugerida ${hora} · ${dur} min`;
  if (hora) return `Sugerida ${hora}`;
  if (dur) return `Duración estimada: ${dur} min`;
  return null;
}

/**
 * Texto de horario para un Evento (compromiso fijo):
 *   "09:15–14:15"
 *
 * `allDay` se maneja por separado en la UI.
 */
export function eventTimeRange(e: CalendarEvent): string {
  if (e.allDay) return "Todo el día";
  return `${format(e.start, "HH:mm")}–${format(e.end, "HH:mm")}`;
}

/**
 * Texto de horario listo para mostrar en las tarjetas del
 * calendario, ya diferenciado por tipo.
 */
export function scheduleText(e: CalendarEvent): string | null {
  if (e.allDay) return "Todo el día";
  if (isEvento(e)) return eventTimeRange(e);
  return taskScheduleText(e);
}

/** Microtexto para el chip discreto ("Tarea" / "Evento"). */
export function typeLabel(e: CalendarEvent): "Tarea" | "Evento" {
  return isEvento(e) ? "Evento" : "Tarea";
}

/**
 * Etiqueta accesible completa. Los íconos decorativos usan
 * `aria-hidden`, así que el tipo se comunica en el texto que
 * los lectores de pantalla escuchan.
 */
export function ariaTypeLabel(e: CalendarEvent): string {
  return isEvento(e) ? "Evento" : "Tarea";
}
