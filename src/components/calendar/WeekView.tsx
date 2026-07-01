import { useMemo } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { CalendarEvent } from "@/services/calendarService";
import { areaColor } from "./areaColors";

interface Props {
  anchor: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}

// Franja horaria visible: 07:00 → 21:00
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 56; // altura de cada hora
const TOTAL_HOURS = END_HOUR - START_HOUR;

export function WeekView({ anchor, events, onSelectEvent }: Props) {
  const inicio = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(inicio, i)), [inicio]);
  const hoy = new Date();

  const allDayPorDia = (d: Date) => events.filter((e) => e.allDay && isSameDay(e.start, d));
  const timedPorDia = (d: Date) => events.filter((e) => !e.allDay && isSameDay(e.start, d));

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Cabecera de días */}
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-slate-100">
        <div />
        {dias.map((d) => {
          const activo = isSameDay(d, hoy);
          return (
            <div key={d.toISOString()} className="py-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                {format(d, "EEE", { locale: es })}
              </div>
              <div
                className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  activo ? "bg-indigo-600 text-white" : "text-slate-700"
                }`}
              >
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Franja "Todo el día" (sólo si hay algo) */}
      {dias.some((d) => allDayPorDia(d).length > 0) && (
        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-slate-100 bg-slate-50/50">
          <div className="px-1 py-2 text-[10px] uppercase tracking-widest text-slate-400 text-right pr-2">
            Día
          </div>
          {dias.map((d) => (
            <div key={d.toISOString()} className="p-1 space-y-1 min-h-8">
              {allDayPorDia(d).map((e) => (
                <EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Cuerpo con horas */}
      <div className="relative grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
        {/* Columna horas */}
        <div>
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

        {/* 7 columnas de día */}
        {dias.map((d) => (
          <div key={d.toISOString()} className="relative border-l border-slate-100">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={i} style={{ height: HOUR_PX }} className="border-b border-slate-100" />
            ))}
            {timedPorDia(d).map((e) => (
              <EventBlock key={e.id} event={e} onClick={() => onSelectEvent(e)} />
            ))}
          </div>
        ))}
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
