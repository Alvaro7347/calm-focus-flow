/**
 * ========================================================
 * Archivo: components/calendar/WeekView
 *
 * Responsabilidad:
 * Vista semanal del calendario. Muestra los 7 días con una
 * columna fija de horas a la izquierda y una zona derecha
 * con scroll horizontal independiente para poder recorrer
 * los días sin comprimir el ancho de cada columna.
 *
 * Reglas de layout (iteración de legibilidad):
 * - La columna de horas queda "sticky left" para que
 *   siempre acompañe al día visible.
 * - Cada columna de día tiene un ancho mínimo de 128 px
 *   (rango objetivo 120–140 px) para evitar que los
 *   títulos se corten.
 * - Sólo la fila de días se desplaza horizontalmente; el
 *   resto del layout (header de la página, tab bar, FAB)
 *   no se ve afectado.
 * ========================================================
 */
import { useMemo } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { CalendarEvent } from "@/services/calendarService";
import { areaColor } from "./areaColors";
import { getProjectColor } from "@/lib/projectIdentity";

interface Props {
  anchor: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}

// Franja horaria visible: 07:00 → 21:00
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 56;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const DAY_COL_MIN = 128; // px — dentro del rango 120–140 solicitado

export function WeekView({ anchor, events, onSelectEvent }: Props) {
  const inicio = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(inicio, i)), [inicio]);
  const hoy = new Date();

  const allDayPorDia = (d: Date) => events.filter((e) => e.allDay && isSameDay(e.start, d));
  const timedPorDia = (d: Date) => events.filter((e) => !e.allDay && isSameDay(e.start, d));
  const hayAllDay = dias.some((d) => allDayPorDia(d).length > 0);

  return (
    // overflow-x-auto habilita el scroll horizontal SÓLO dentro del calendario.
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <div className="flex min-w-max">
        {/* Columna fija de horas: sticky para acompañar el scroll horizontal. */}
        <div className="sticky left-0 z-10 shrink-0 w-12 bg-white border-r border-slate-100">
          {/* Hueco alineado con el header compacto de días (una sola línea). */}
          <div className="h-10 border-b border-slate-100" />
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div
              key={i}
              style={{ height: HOUR_PX }}
              className="pr-2 pt-1 text-right text-[10px] text-slate-400 border-b border-slate-100"
            >
              {String(START_HOUR + i).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Zona derecha: 7 columnas de día, cada una con ancho mínimo legible. */}
        {dias.map((d) => {
          const activo = isSameDay(d, hoy);
          const allDay = allDayPorDia(d);
          const timed = timedPorDia(d);
          return (
            <div
              key={d.toISOString()}
              style={{ minWidth: DAY_COL_MIN }}
              className="flex-1 border-l border-slate-100"
            >
              {/* Header compacto en una sola línea: "Mié 1". El día actual
                  se marca con un pequeño círculo índigo (indicador, no botón). */}
              <div className="h-10 flex items-center justify-center gap-1.5 border-b border-slate-100 text-sm text-slate-700">
                <span className="capitalize text-slate-500">
                  {format(d, "EEE", { locale: es })}
                </span>
                <span
                  className={
                    activo
                      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-semibold"
                      : "font-semibold"
                  }
                >
                  {format(d, "d")}
                </span>
              </div>

              {/* Franja "Todo el día": aparece directamente bajo el header,
                  sin fila-etiqueta previa, sólo cuando algún día la usa. */}
              {hayAllDay && (
                <div className="min-h-8 p-1 space-y-1 border-b border-slate-100 bg-slate-50/50">
                  {allDay.map((e) => (
                    <EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} />
                  ))}
                </div>

              )}

              {/* Cuerpo horario */}
              <div className="relative">
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={i} style={{ height: HOUR_PX }} className="border-b border-slate-100" />
                ))}
                {timed.map((e) => (
                  <EventBlock key={e.id} event={e} onClick={() => onSelectEvent(e)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventBlock({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const c = areaColor(event.area);
  const startMin = event.start.getHours() * 60 + event.start.getMinutes();
  const endMin = event.end.getHours() * 60 + event.end.getMinutes();
  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_PX;
  const height = Math.max(24, ((endMin - startMin) / 60) * HOUR_PX - 2);
  const outOfRange = startMin < START_HOUR * 60 || startMin >= END_HOUR * 60;
  if (outOfRange) return null;

  const done = event.completada;
  return (
    <button
      onClick={onClick}
      style={{ top, height }}
      className={`absolute left-1 right-1 rounded-md border-l-2 px-2 py-1 text-left text-[11px] leading-tight overflow-hidden transition-shadow hover:shadow-sm ${
        done ? "bg-slate-50 border-l-slate-300 text-slate-400 line-through" : `${c.bg} ${c.border} ${c.text}`
      }`}
    >
      <div className="font-medium truncate">{event.titulo}</div>
    </button>
  );
}

function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const c = areaColor(event.area);
  const done = event.completada;
  return (
    <button
      onClick={onClick}
      className={`w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-left ${
        done ? "bg-slate-100 text-slate-400 line-through" : `${c.bg} ${c.text}`
      }`}
    >
      {event.titulo}
    </button>
  );
}
