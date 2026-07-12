/**
 * ========================================================
 * Archivo: components/calendar/DayView
 *
 * Responsabilidad:
 * Vista diaria específica para MOBILE dentro del apartado
 * Calendario. Reemplaza a WeekView en pantallas pequeñas
 * porque una grilla de 7 columnas no cabe legiblemente en
 * un teléfono.
 *
 * Estructura:
 * - Un selector horizontal con los 7 días de la semana
 *   (Lun 6, Mar 7, …). Es el único elemento con
 *   overflow-x: no arrastra a toda la pantalla.
 * - Debajo, la lista vertical de eventos del día
 *   seleccionado. Sin grilla horaria absoluta: cada evento
 *   es un bloque a ancho completo, con hora + título.
 *
 * Reglas de diseño:
 * - No hay position:absolute para eventos: se apilan como
 *   cards verticales, evitando superposiciones en mobile.
 * - Ancho 100% del contenedor padre — nada de widths fijos
 *   que provoquen overflow horizontal en el body.
 * - El color de identidad visual del área se aplica como
 *   borde izquierdo del card, coherente con FOCO.
 * ========================================================
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Circle } from "lucide-react";
import type { CalendarEvent } from "@/services/calendarService";
import { getProjectColor } from "@/lib/projectIdentity";
import { isEvento, scheduleText, typeLabel, ariaTypeLabel } from "@/lib/activityDisplay";

interface Props {
  anchor: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}

export function DayView({ anchor, events, onSelectEvent }: Props) {
  const inicio = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(inicio, i)), [inicio]);
  const hoy = new Date();

  // Día seleccionado: por defecto, el "anchor" si cae en la semana; si no, hoy si cae; si no, el lunes.
  const initial = useMemo(() => {
    const candidatos = [anchor, hoy];
    for (const c of candidatos) {
      if (dias.some((d) => isSameDay(d, c))) return c;
    }
    return dias[0];
  }, [anchor, dias]);

  const [selected, setSelected] = useState<Date>(initial);
  useEffect(() => {
    setSelected(initial);
  }, [initial]);

  // Auto-scroll del selector al día seleccionado.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const key = selected.toDateString();
    const btn = btnRefs.current[key];
    if (btn && scrollerRef.current) {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selected]);

  const eventosDia = useMemo(
    () =>
      events
        .filter((e) => isSameDay(e.start, selected))
        .slice()
        .sort((a, b) => {
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
          return a.start.getTime() - b.start.getTime();
        }),
    [events, selected],
  );

  return (
    <div className="w-full max-w-full">
      {/* Selector horizontal de días. Único overflow-x del layout. */}
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {dias.map((d) => {
          const activo = isSameDay(d, selected);
          const esHoy = isSameDay(d, hoy);
          const count = events.filter((e) => isSameDay(e.start, d)).length;
          const key = d.toDateString();
          return (
            <button
              key={key}
              ref={(el) => {
                btnRefs.current[key] = el;
              }}
              onClick={() => setSelected(d)}
              className={`shrink-0 flex flex-col items-center rounded-xl border px-3 py-2 min-w-14 transition-colors ${
                activo
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span
                className={`text-[10px] uppercase tracking-widest ${
                  activo ? "text-indigo-100" : "text-slate-400"
                }`}
              >
                {format(d, "EEE", { locale: es })}
              </span>
              <span
                className={`mt-0.5 text-lg font-semibold ${
                  esHoy && !activo ? "text-indigo-600" : ""
                }`}
              >
                {format(d, "d")}
              </span>
              <span
                className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                  count > 0
                    ? activo
                      ? "bg-white"
                      : "bg-indigo-500"
                    : "bg-transparent"
                }`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {/* Encabezado del día seleccionado */}
      <div className="mt-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-slate-900 capitalize">
          {format(selected, "EEEE d 'de' MMMM", { locale: es })}
        </h2>
        <span className="text-xs text-slate-400">
          {eventosDia.length} {eventosDia.length === 1 ? "tarea" : "tareas"}
        </span>
      </div>

      {/* Lista vertical de eventos */}
      <ul className="mt-3 space-y-2">
        {eventosDia.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-400">
            Sin tareas para este día.
          </li>
        )}
        {eventosDia.map((e) => {
          const pc = getProjectColor(e.proyectoColor);
          const done = e.completada;
          const evento = isEvento(e);
          const TypeIcon = evento ? CalendarIcon : Circle;
          const sched = scheduleText(e);
          return (
            <li key={e.id}>
              <button
                onClick={() => onSelectEvent(e)}
                aria-label={`${ariaTypeLabel(e)}: ${e.titulo}${sched ? ` — ${sched}` : ""}`}
                className={`w-full rounded-xl border border-slate-200 border-l-4 ${pc.border} p-3 text-left transition-colors hover:bg-slate-50 ${
                  evento && !done ? "bg-slate-50/60" : "bg-white"
                } ${done ? "opacity-70" : ""}`}
              >
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${pc.dot}`} aria-hidden />
                  <span className="truncate">{e.area}</span>
                  <span className="ml-auto shrink-0 inline-flex items-center gap-1">
                    <TypeIcon className="h-3 w-3 opacity-70" aria-hidden />
                    <span>{sched ?? typeLabel(e)}</span>
                  </span>
                </div>
                <div
                  className={`mt-1 text-sm font-medium ${
                    done ? "text-slate-400 line-through" : "text-slate-900"
                  }`}
                >
                  {e.titulo}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="uppercase tracking-wide">{typeLabel(e)}</span>
                  {e.proyecto && <span className="truncate">· {e.proyecto}</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
