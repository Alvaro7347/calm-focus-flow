/**
 * ========================================================
 * Archivo: calendarService
 *
 * Responsabilidad:
 * Provee los eventos que se muestran en el módulo Calendar.
 * Actúa como capa única y desacoplada entre la UI y el
 * modelo de tareas: consume `taskService.fetchScheduledTasks()`
 * (Supabase) y transforma las tareas con `fechaProgramada` en
 * `CalendarEvent`s. En el futuro combinará también eventos
 * externos (Google Calendar) sin que la UI cambie.
 *
 * Reglas:
 * - No conoce mocks ni consulta Supabase directamente: sólo
 *   habla con taskService.
 * - Sólo aparecen en Calendar las tareas con `starts_at`
 *   válido (garantizado ya por taskService).
 * - El estado (completada, prioridad) proviene siempre de
 *   la propia tarea.
 * - El filtrado por rango [from, to] es responsabilidad de
 *   esta capa, no de la UI.
 *
 * Utilizado por:
 * - CalendarioPage (src/routes/calendario.tsx) vía TanStack
 *   Query bajo la queryKey ["calendar", from, to].
 * ========================================================
 */
import { fetchScheduledTasks } from "@/services/taskService";
import type { Tarea, Priority } from "@/types/tarea";
import { isSameDay, parseISO, addMinutes } from "date-fns";

export type EventSource = "calmapp" | "google";

export interface CalendarEvent {
  id: string;
  titulo: string;
  area: string;
  proyecto?: string;
  /** Slug de la paleta CalmApp del proyecto (identidad visual). */
  proyectoColor?: string | null;
  subproyecto?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  completada: boolean;
  source: EventSource;
  /**
   * Prioridad propagada desde la Tarea original. Se declara aquí
   * (no sólo dentro de `tarea`) para que consumidores externos —
   * futuros eventos de Google Calendar, filtros, agrupadores —
   * puedan leerla sin depender de la Tarea original.
   */
  priority: Priority;
  /** Tarea original si viene de CalmApp. Útil para el detalle. */
  tarea?: Tarea;
}

function tareaToEvent(t: Tarea): CalendarEvent | null {
  // Sólo entran al calendario las tareas con fecha real.
  if (!t.fechaProgramada) return null;
  const fecha = parseISO(t.fechaProgramada);
  if (isNaN(fecha.getTime())) return null;

  const allDay = !t.horaInicio;
  let start = fecha;
  let end = fecha;
  if (!allDay && t.horaInicio) {
    const [h, m] = t.horaInicio.split(":").map(Number);
    start = new Date(fecha);
    start.setHours(h, m ?? 0, 0, 0);
    // Los eventos traen su fin explícito; las tareas usan duración estimada.
    if (t.finISO) {
      end = new Date(t.finISO);
    } else {
      end = addMinutes(start, t.duracionMin ?? 60);
    }
  }

  return {
    id: t.id,
    titulo: t.titulo,
    area: t.area,
    proyecto: t.proyecto,
    proyectoColor: t.proyectoColor ?? null,
    subproyecto: t.subproyecto,
    start,
    end,
    allDay,
    completada: t.completada ?? false,
    priority: t.priority ?? "normal",
    source: "calmapp",
    tarea: t,
  };
}

/**
 * Devuelve los eventos del calendario desde Supabase. Si se pasan
 * `from`/`to`, filtra a los que solapan con ese rango (inclusive).
 * Esta capa es el único punto donde se define el filtrado por rango,
 * listo para cuando se combinen eventos de Google Calendar.
 */
export async function getCalendarEvents(
  from?: Date,
  to?: Date,
): Promise<CalendarEvent[]> {
  const tareas = await fetchScheduledTasks();
  const desdeCalmApp = tareas
    .map(tareaToEvent)
    .filter((e): e is CalendarEvent => e !== null);

  // Futuro: combinar aquí eventos de Google Calendar dentro del mismo rango.
  const todos = desdeCalmApp;

  if (!from && !to) return todos;
  const desde = from?.getTime() ?? -Infinity;
  const hasta = to?.getTime() ?? Infinity;
  // Un evento entra si su intervalo [start, end] solapa con [from, to].
  return todos.filter(
    (e) => e.end.getTime() >= desde && e.start.getTime() <= hasta,
  );
}

/** Devuelve todos los eventos que caen en un día dado (incluye all-day). */
export function eventsOnDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events.filter((e) => isSameDay(e.start, day));
}
