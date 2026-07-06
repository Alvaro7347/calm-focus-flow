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
 *
 * Reglas de colisión (iteración "nunca ocultar tareas"):
 * - La lógica de reparto en carriles vive en
 *   `@/lib/calendarLayout` (algoritmo agnóstico del origen
 *   del evento, ver documentación allí).
 * - Cuando varios eventos coinciden en la misma franja,
 *   se reparten en carriles laterales (`lane / lanes`)
 *   para que ninguno tape a otro.
 * - Cuando la concurrencia máxima de una hora supera 2, la
 *   altura de esa franja aumenta proporcionalmente para que
 *   cada bloque conserve una altura mínima legible. La
 *   altura se aplica a las 7 columnas por igual para no
 *   romper la alineación de la rejilla horaria.
 * ========================================================
 */
import { useMemo } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { CalendarEvent } from "@/services/calendarService";
import { getProjectColor } from "@/lib/projectIdentity";
import {
  layoutDayEvents,
  maxConcurrencyPerHour,
  type LayoutInput,
  type LayoutResult,
} from "@/lib/calendarLayout";

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

/**
 * Función de escalado de la altura de una franja horaria a
 * partir de la concurrencia máxima observada en ella.
 *
 *   concurrencia ≤ 2 → altura base (HOUR_PX)
 *   concurrencia = 3-4 → 2× la altura base
 *   concurrencia = 5-6 → 3× la altura base
 *   …y así sucesivamente
 *
 * Regla: cada "par" adicional de eventos simultáneos añade una
 * fila de HOUR_PX. Así garantizamos que cada bloque mantenga
 * al menos ~28 px verticales, suficiente para leer el título.
 */
function rowHeightForConcurrency(concurrency: number): number {
  const factor = Math.max(1, Math.ceil(concurrency / 2));
  return HOUR_PX * factor;
}

export function WeekView({ anchor, events, onSelectEvent }: Props) {
  const inicio = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(inicio, i)), [inicio]);
  const hoy = new Date();

  const allDayPorDia = (d: Date) => events.filter((e) => e.allDay && isSameDay(e.start, d));
  const timedPorDia = (d: Date) => events.filter((e) => !e.allDay && isSameDay(e.start, d));
  const hayAllDay = dias.some((d) => allDayPorDia(d).length > 0);

  /**
   * Layout precomputado por día:
   *   - lista de eventos con minutos absolutos
   *   - mapa id → carril asignado y total de carriles
   * Y en paralelo, la concurrencia máxima por hora agregada de
   * los 7 días, que determina la altura dinámica compartida.
   */
  const { layoutsPorDia, rowHeights, rowOffsets, totalHeight } = useMemo(() => {
    const layoutsPorDia = new Map<string, Map<string, LayoutResult>>();
    const inputsPorDia: LayoutInput[][] = [];

    for (const d of dias) {
      const key = d.toDateString();
      const timed = events.filter((e) => !e.allDay && isSameDay(e.start, d));
      const inputs: LayoutInput[] = timed.map((e) => ({
        id: e.id,
        startMin: e.start.getHours() * 60 + e.start.getMinutes(),
        endMin: e.end.getHours() * 60 + e.end.getMinutes(),
      }));
      inputsPorDia.push(inputs);
      layoutsPorDia.set(key, layoutDayEvents(inputs));
    }

    // Concurrencia máxima por hora tomando el máximo entre todos los días.
    const perHour = new Array<number>(TOTAL_HOURS).fill(0);
    for (const inputs of inputsPorDia) {
      const arr = maxConcurrencyPerHour(inputs, START_HOUR, END_HOUR);
      for (let i = 0; i < TOTAL_HOURS; i++) {
        if (arr[i] > perHour[i]) perHour[i] = arr[i];
      }
    }

    const rowHeights = perHour.map(rowHeightForConcurrency);
    const rowOffsets = new Array<number>(TOTAL_HOURS).fill(0);
    for (let i = 1; i < TOTAL_HOURS; i++) {
      rowOffsets[i] = rowOffsets[i - 1] + rowHeights[i - 1];
    }
    const totalHeight = rowOffsets[TOTAL_HOURS - 1] + (rowHeights[TOTAL_HOURS - 1] ?? 0);
    return { layoutsPorDia, rowHeights, rowOffsets, totalHeight };
  }, [dias, events]);

  /**
   * Convierte una marca en minutos (desde 00:00) a la posición
   * vertical dentro del cuerpo horario, respetando la altura
   * dinámica de cada franja. Interpola linealmente dentro de la
   * hora correspondiente.
   */
  const minToPx = (min: number): number => {
    const clamped = Math.max(START_HOUR * 60, Math.min(min, END_HOUR * 60));
    const relMin = clamped - START_HOUR * 60;
    const hourIdx = Math.min(TOTAL_HOURS - 1, Math.floor(relMin / 60));
    const inHour = relMin - hourIdx * 60;
    return rowOffsets[hourIdx] + (inHour / 60) * rowHeights[hourIdx];
  };

  return (
    // overflow-x-auto habilita el scroll horizontal SÓLO dentro del calendario.
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <div className="flex min-w-max">
        {/* Columna fija de horas: sticky para acompañar el scroll horizontal. */}
        <div className="sticky left-0 z-10 shrink-0 w-12 bg-white border-r border-slate-100">
          {/* Hueco alineado con el header compacto de días (una sola línea). */}
          <div className="h-10 border-b border-slate-100" />
          {hayAllDay && <div className="min-h-8 border-b border-slate-100 bg-slate-50/50" />}
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div
              key={i}
              style={{ height: rowHeights[i] }}
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
          const layout = layoutsPorDia.get(d.toDateString());
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
              <div className="relative px-1" style={{ height: totalHeight }}>
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    style={{ height: rowHeights[i] }}
                    className="border-b border-slate-100"
                  />
                ))}
                <div className="absolute inset-x-1 inset-y-0 pointer-events-none">
                  {timed.map((e) => {
                    const info = layout?.get(e.id);
                    return (
                      <EventBlock
                        key={e.id}
                        event={e}
                        lane={info?.lane ?? 0}
                        lanes={info?.lanes ?? 1}
                        minToPx={minToPx}
                        onClick={() => onSelectEvent(e)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventBlock({
  event,
  lane,
  lanes,
  minToPx,
  onClick,
}: {
  event: CalendarEvent;
  lane: number;
  lanes: number;
  minToPx: (min: number) => number;
  onClick: () => void;
}) {
  const pc = getProjectColor(event.proyectoColor);
  const startMin = event.start.getHours() * 60 + event.start.getMinutes();
  const endMin = event.end.getHours() * 60 + event.end.getMinutes();
  const outOfRange = startMin < START_HOUR * 60 || startMin >= END_HOUR * 60;
  if (outOfRange) return null;

  const top = minToPx(startMin);
  const bottom = minToPx(endMin);
  const height = Math.max(24, bottom - top - 2);

  // Reparto horizontal en carriles. Se dejan 4 px de margen a
  // cada lado del contenedor y 2 px de separación entre carriles.
  const gapPct = lanes > 1 ? 1.5 : 0;
  const widthPct = (100 - gapPct * (lanes - 1)) / lanes;
  const leftPct = lane * (widthPct + gapPct);

  const done = event.completada;
  return (
    <button
      onClick={onClick}
      style={{
        top,
        height,
        left: `calc(4px + ${leftPct}% * (100% - 8px) / 100%)`,
        width: `calc(${widthPct}% * (100% - 8px) / 100%)`,
      }}
      className={`absolute rounded-md border-l-2 px-2 py-1 text-left text-[11px] leading-tight overflow-hidden transition-shadow hover:shadow-sm ${
        done ? "bg-slate-50 border-l-slate-300 text-slate-400 line-through" : `${pc.soft} ${pc.border} ${pc.text}`
      }`}
    >
      <div className="font-medium truncate">{event.titulo}</div>
    </button>
  );
}

function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const pc = getProjectColor(event.proyectoColor);
  const done = event.completada;
  return (
    <button
      onClick={onClick}
      className={`w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-left ${
        done ? "bg-slate-100 text-slate-400 line-through" : `${pc.soft} ${pc.text}`
      }`}
    >
      {event.titulo}
    </button>
  );
}
