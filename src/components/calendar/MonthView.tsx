import { useMemo, useState } from "react";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { X } from "lucide-react";
import type { CalendarEvent } from "@/services/calendarService";
import { areaColor } from "./areaColors";

interface Props {
  anchor: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}

export function MonthView({ anchor, events, onSelectEvent }: Props) {
  const [dayDetail, setDayDetail] = useState<Date | null>(null);

  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const fin = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = inicio;
    while (d <= fin) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [anchor]);

  const hoy = new Date();
  const eventosDia = (d: Date) => events.filter((e) => isSameDay(e.start, d));

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Cabecera días */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="py-2 text-center text-[10px] uppercase tracking-widest text-slate-400">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const enMes = isSameMonth(d, anchor);
          const esHoy = isSameDay(d, hoy);
          const evs = eventosDia(d);
          const visibles = evs.slice(0, 2);
          const extra = evs.length - visibles.length;

          return (
            <button
              key={d.toISOString()}
              onClick={() => setDayDetail(d)}
              className={`min-h-20 md:min-h-24 border-b border-r border-slate-100 p-1.5 text-left flex flex-col gap-1 hover:bg-slate-50/60 transition-colors ${
                enMes ? "" : "bg-slate-50/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    esHoy
                      ? "bg-indigo-600 text-white"
                      : enMes
                      ? "text-slate-700"
                      : "text-slate-300"
                  }`}
                >
                  {format(d, "d")}
                </span>
              </div>

              <div className="flex-1 space-y-0.5">
                {visibles.map((e) => (
                  <MiniEvent key={e.id} event={e} />
                ))}
                {extra > 0 && (
                  <div className="text-[10px] font-medium text-indigo-600">+{extra}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <DayDetailSheet
        day={dayDetail}
        events={dayDetail ? eventosDia(dayDetail) : []}
        onClose={() => setDayDetail(null)}
        onSelectEvent={(e) => {
          setDayDetail(null);
          onSelectEvent(e);
        }}
      />
    </div>
  );
}

function MiniEvent({ event }: { event: CalendarEvent }) {
  const c = areaColor(event.area);
  const done = event.completada;
  return (
    <div
      className={`flex items-center gap-1 truncate rounded px-1 text-[10px] leading-tight ${
        done ? "text-slate-400 line-through" : c.text
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${done ? "bg-slate-300" : c.dot}`} aria-hidden />
      <span className="truncate">{event.titulo}</span>
    </div>
  );
}

function DayDetailSheet({
  day,
  events,
  onClose,
  onSelectEvent,
}: {
  day: Date | null;
  events: CalendarEvent[];
  onClose: () => void;
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  const open = !!day;
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl transition-transform md:inset-auto md:right-6 md:top-24 md:bottom-auto md:w-96 md:rounded-2xl ${
          open ? "translate-y-0" : "translate-y-full md:translate-y-0 md:opacity-0 md:pointer-events-none"
        }`}
        role="dialog"
        aria-label="Detalle del día"
      >
        {day && (
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-400">
                  {format(day, "EEEE", { locale: es })}
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {format(day, "d 'de' MMMM", { locale: es })}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-5 space-y-2">
              {events.length === 0 && (
                <li className="text-sm text-slate-400">Sin tareas para este día.</li>
              )}
              {events.map((e) => {
                const c = areaColor(e.area);
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => onSelectEvent(e)}
                      className={`w-full rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50 ${e.completada ? "opacity-70" : ""}`}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden />
                        {e.area}
                        <span className="ml-auto">
                          {e.allDay ? "Todo el día" : format(e.start, "HH:mm")}
                        </span>
                      </div>
                      <div className={`mt-1 text-sm font-medium ${e.completada ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {e.titulo}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
