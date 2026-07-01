/**
 * ========================================================
 * Archivo: calendarService
 *
 * Responsabilidad:
 * Provee los eventos que se muestran en el módulo Calendar.
 * Actúa como capa única y desacoplada entre la UI y los
 * orígenes de datos: hoy sólo tareas de CalmApp (desde
 * mockFocus), en el futuro también eventos externos
 * (Google Calendar) sin que la UI cambie.
 *
 * Utilizado por:
 * - CalendarioPage (src/routes/calendario.tsx)
 * - Vistas Semana y Mes
 *
 * En el MVP1 esta capa leerá tareas desde Supabase y
 * combinará eventos externos, exponiendo la misma interfaz
 * `CalendarEvent`.
 * ========================================================
 */
import { tareasFoco } from "@/data/mockFocus";
import type { Tarea, Priority } from "@/types/tarea";
import {
  addDays,
  startOfWeek,
  isSameDay,
  parseISO,
  addMinutes,
} from "date-fns";

export type EventSource = "calmapp" | "google";

export interface CalendarEvent {
  id: string;
  titulo: string;
  area: string;
  proyecto?: string;
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

/**
 * Mapea etiquetas cortas de día ("Mié 2", "Jue 3"...) usadas en
 * los mocks de FOCO al índice de día ISO (0=Domingo).
 * En el MVP1 esto desaparece: la tarea tendrá `fechaProgramada` real.
 */
const DIA_INDEX: Record<string, number> = {
  Dom: 0, Lun: 1, Mar: 2, Mié: 3, Jue: 4, Vie: 5, Sáb: 6,
};

function resolveFechaTarea(t: Tarea, hoy: Date): Date | null {
  if (t.fechaProgramada) return parseISO(t.fechaProgramada);
  if (t.categoriaFoco === "hoy") return hoy;
  if (t.categoriaFoco === "esta_semana" && t.diaEtiqueta) {
    const abrev = t.diaEtiqueta.split(" ")[0];
    const idx = DIA_INDEX[abrev];
    if (idx === undefined) return null;
    const inicioSemana = startOfWeek(hoy, { weekStartsOn: 1 });
    // startOfWeek con weekStartsOn:1 -> lunes en offset 0
    const offset = (idx + 6) % 7; // lunes=0..domingo=6
    return addDays(inicioSemana, offset);
  }
  return null;
}

function tareaToEvent(t: Tarea, hoy: Date): CalendarEvent | null {
  const fecha = resolveFechaTarea(t, hoy);
  if (!fecha) return null;

  const allDay = !t.horaInicio;
  let start = fecha;
  let end = fecha;
  if (!allDay && t.horaInicio) {
    const [h, m] = t.horaInicio.split(":").map(Number);
    start = new Date(fecha);
    start.setHours(h, m ?? 0, 0, 0);
    end = addMinutes(start, t.duracionMin ?? 60);
  }

  // Demo: marcar una tarea vencida como completada para poder
  // ver el estilo tachado en Calendar.
  const completada = t.completada ?? (t.id === "h6");

  return {
    id: t.id,
    titulo: t.titulo,
    area: t.area,
    proyecto: t.proyecto,
    subproyecto: t.subproyecto,
    start,
    end,
    allDay,
    completada,
    // Prioridad propagada desde la Tarea. "normal" es el default
    // explícito para que la UI/consumidores no tengan que manejar undefined.
    priority: t.priority ?? "normal",
    source: "calmapp",
    tarea: t,
  };
}

/**
 * Devuelve los eventos del calendario. Si se pasan `from`/`to`,
 * filtra a los que solapan con ese rango (inclusive). Esta capa
 * es el único punto donde se define el filtrado por rango, listo
 * para cuando la fuente sea Supabase o Google Calendar.
 */
export function getCalendarEvents(from?: Date, to?: Date): CalendarEvent[] {
  const hoy = new Date();
  const desdeCalmApp = tareasFoco
    .map((t) => tareaToEvent(t, hoy))
    .filter((e): e is CalendarEvent => e !== null);

  // Futuro: combinar aquí eventos de Google Calendar dentro del mismo rango.
  const todos = desdeCalmApp;

  if (!from && !to) return todos;
  const desde = from?.getTime() ?? -Infinity;
  const hasta = to?.getTime() ?? Infinity;
  // Un evento entra si su intervalo [start, end] solapa con [from, to].
  return todos.filter((e) => e.end.getTime() >= desde && e.start.getTime() <= hasta);
}

/** Devuelve todos los eventos que caen en un día dado (incluye all-day). */
export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => isSameDay(e.start, day));
}
