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
import { Calendar as CalendarIcon, Circle } from "lucide-react";
import type { CalendarEvent } from "@/services/calendarService";
import { getProjectColor } from "@/lib/projectIdentity";
import {
  isEvento,
  scheduleText,
  ariaTypeLabel,
} from "@/lib/activityDisplay";
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
 * Iteración de legibilidad ("nunca ocultar información"):
 *
 *   concurrencia ≤ 2 → altura base (HOUR_PX)
 *                       — se reparte en 2 carriles horizontales.
 *   concurrencia ≥ 3 → la franja crece linealmente en altura y
 *                       la UI reorganiza el clúster en una
 *                       cuadrícula de 2 columnas × N filas.
 *                       Preferimos aumentar la altura antes que
 *                       seguir estrechando el ancho de cada
 *                       bloque, para que los títulos sigan
 *                       siendo legibles (idealmente 2 líneas).
 *
 * Con concurrencia 3 → 1.5×, 4 → 2×, 5 → 2.5×, 6 → 3×, etc.
 * Es decir, cada evento simultáneo adicional (por encima de 2)
 * aporta media fila (HOUR_PX / 2 ≈ 28 px), suficiente para que
 * al partir el clúster en 2 columnas cada slot mantenga
 * ~36-40 px verticales.
 */
function rowHeightForConcurrency(concurrency: number): number {
  if (concurrency <= 2) return HOUR_PX;
  const extra = concurrency - 2;
  return HOUR_PX + extra * (HOUR_PX / 2);
}

/** Ancho mínimo aceptable por bloque cuando repartimos en carriles. */
const MAX_HORIZONTAL_LANES = 2;

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
  const { layoutsPorDia, inputsById, rowHeights, rowOffsets, totalHeight } = useMemo(() => {
    const layoutsPorDia = new Map<string, Map<string, LayoutResult>>();
    const inputsById = new Map<string, LayoutInput>();
    const inputsPorDia: LayoutInput[][] = [];

    for (const d of dias) {
      const key = d.toDateString();
      const timed = events.filter((e) => !e.allDay && isSameDay(e.start, d));
      const inputs: LayoutInput[] = timed.map((e) => ({
        id: e.id,
        startMin: e.start.getHours() * 60 + e.start.getMinutes(),
        endMin: e.end.getHours() * 60 + e.end.getMinutes(),
      }));
      inputs.forEach((it) => inputsById.set(it.id, it));
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
    return { layoutsPorDia, inputsById, rowHeights, rowOffsets, totalHeight };
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

  /**
   * Placements finales por día.
   *
   * Regla de reorganización (iteración de legibilidad):
   *   • Clúster con `lanes` ≤ 2  → mantenemos el reparto en
   *     carriles horizontales del algoritmo actual, cada evento
   *     ocupa exactamente su intervalo temporal.
   *   • Clúster con `lanes` ≥ 3  → en lugar de seguir dividiendo
   *     el ancho de la columna del día en 3+ carriles (títulos
   *     ilegibles), reorganizamos el clúster en una cuadrícula
   *     de 2 columnas × ⌈N/2⌉ filas dentro del rango temporal
   *     del clúster. Como `rowHeightForConcurrency` crece
   *     linealmente con la concurrencia (ver arriba), la franja
   *     dispone de altura suficiente para que cada slot tenga
   *     ~36-40 px y admita 2 líneas de título.
   *
   * Todo esto vive únicamente en la capa de presentación: no se
   * duplica ni se altera `calendarLayout.ts`, que sigue siendo
   * la fuente única de la lógica de colisiones.
   */
  interface Placement {
    top: number;
    height: number;
    leftPct: number;
    widthPct: number;
    /** true cuando el bloque tiene altura suficiente para dos líneas. */
    twoLines: boolean;
  }

  const placementsPorDia = useMemo(() => {
    const out = new Map<string, Map<string, Placement>>();

    for (const d of dias) {
      const key = d.toDateString();
      const layout = layoutsPorDia.get(key);
      const dayIds = events
        .filter((e) => !e.allDay && isSameDay(e.start, d))
        .map((e) => e.id);
      const placements = new Map<string, Placement>();
      if (!layout || dayIds.length === 0) {
        out.set(key, placements);
        continue;
      }

      // Agrupamos por clúster: eventos que comparten el mismo
      // total de carriles y solapan transitivamente. Usamos el
      // mismo criterio de agrupación que calendarLayout (sweep
      // por start ascendente) para mantener consistencia.
      const dayInputs = dayIds
        .map((id) => inputsById.get(id))
        .filter((x): x is LayoutInput => !!x)
        .sort((a, b) => a.startMin - b.startMin);

      let clusterEnd = -Infinity;
      let cluster: LayoutInput[] = [];

      const flushCluster = () => {
        if (cluster.length === 0) return;
        const lanes = layout.get(cluster[0].id)?.lanes ?? 1;
        if (lanes <= MAX_HORIZONTAL_LANES) {
          // Modo carriles horizontales (comportamiento actual).
          const gapPct = lanes > 1 ? 1.5 : 0;
          const widthPct = (100 - gapPct * (lanes - 1)) / lanes;
          for (const ev of cluster) {
            const info = layout.get(ev.id);
            const lane = info?.lane ?? 0;
            const top = minToPx(ev.startMin);
            const bottom = minToPx(ev.endMin);
            const height = Math.max(24, bottom - top - 2);
            placements.set(ev.id, {
              top,
              height,
              leftPct: lane * (widthPct + gapPct),
              widthPct,
              twoLines: height >= 40,
            });
          }
        } else {
          // Modo cuadrícula: 2 columnas × ⌈N/2⌉ filas sobre el
          // rango temporal completo del clúster. Rellenamos
          // por orden de inicio (row-major).
          const clusterStart = cluster[0].startMin;
          const clusterFin = cluster.reduce((m, x) => Math.max(m, x.endMin), 0);
          const topPx = minToPx(clusterStart);
          const bottomPx = minToPx(clusterFin);
          const totalH = Math.max(24, bottomPx - topPx - 2);
          const cols = MAX_HORIZONTAL_LANES;
          const rows = Math.ceil(cluster.length / cols);
          const gapPx = 2;
          const slotH = (totalH - gapPx * (rows - 1)) / rows;
          const gapPct = 1.5;
          const widthPct = (100 - gapPct * (cols - 1)) / cols;
          cluster.forEach((ev, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            placements.set(ev.id, {
              top: topPx + row * (slotH + gapPx),
              height: slotH,
              leftPct: col * (widthPct + gapPct),
              widthPct,
              twoLines: slotH >= 40,
            });
          });
        }
        cluster = [];
      };

      for (const ev of dayInputs) {
        if (ev.startMin >= clusterEnd) {
          flushCluster();
          clusterEnd = ev.endMin;
        } else {
          clusterEnd = Math.max(clusterEnd, ev.endMin);
        }
        cluster.push(ev);
      }
      flushCluster();

      out.set(key, placements);
    }
    return out;
    // rowHeights/rowOffsets ya son dependencia indirecta vía minToPx,
    // pero los incluimos explícitamente para que useMemo reaccione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias, events, layoutsPorDia, inputsById, rowHeights, rowOffsets]);


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
                    const placement = placementsPorDia.get(d.toDateString())?.get(e.id);
                    if (!placement) return null;
                    return (
                      <EventBlock
                        key={e.id}
                        event={e}
                        placement={placement}
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

interface Placement {
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  twoLines: boolean;
}

function EventBlock({
  event,
  placement,
  onClick,
}: {
  event: CalendarEvent;
  placement: Placement;
  onClick: () => void;
}) {
  const pc = getProjectColor(event.proyectoColor);
  const startMin = event.start.getHours() * 60 + event.start.getMinutes();
  const outOfRange = startMin < START_HOUR * 60 || startMin >= END_HOUR * 60;
  if (outOfRange) return null;

  const done = event.completada;
  const evento = isEvento(event);
  const TypeIcon = evento ? CalendarIcon : Circle;
  const sched = scheduleText(event);
  // Evento → fondo tenue (`pc.soft`) para señalar bloque reservado.
  // Tarea  → fondo blanco con borde lateral del área, transmite flexibilidad.
  const shellClass = done
    ? "bg-slate-50 border-l-slate-300 text-slate-400 line-through"
    : evento
    ? `${pc.soft} ${pc.border} ${pc.text}`
    : `bg-white ${pc.border} text-slate-800`;
  return (
    <button
      onClick={onClick}
      aria-label={`${ariaTypeLabel(event)}: ${event.titulo}${sched ? ` — ${sched}` : ""}`}
      style={{
        top: placement.top,
        height: placement.height,
        left: `${placement.leftPct}%`,
        width: `${placement.widthPct}%`,
      }}
      className={`pointer-events-auto absolute rounded-md ${evento ? "border border-l-2" : "border border-l-2 border-slate-200"} px-2 py-1 text-left text-[11px] leading-tight overflow-hidden transition-shadow hover:shadow-sm ${shellClass}`}
    >
      <div className="flex items-center gap-1">
        <TypeIcon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        <span
          className={`font-medium ${placement.twoLines ? "line-clamp-2" : "truncate"}`}
        >
          {event.titulo}
        </span>
      </div>
      {placement.twoLines && sched && (
        <div className="mt-0.5 text-[10px] opacity-70 truncate">{sched}</div>
      )}
    </button>
  );
}

function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const pc = getProjectColor(event.proyectoColor);
  const done = event.completada;
  const evento = isEvento(event);
  const TypeIcon = evento ? CalendarIcon : Circle;
  return (
    <button
      onClick={onClick}
      aria-label={`${ariaTypeLabel(event)}: ${event.titulo}`}
      className={`w-full flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-left ${
        done ? "bg-slate-100 text-slate-400 line-through" : evento ? `${pc.soft} ${pc.text}` : `bg-white border ${pc.border} ${pc.text}`
      }`}
    >
      <TypeIcon className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
      <span className="truncate">{event.titulo}</span>
    </button>
  );
}
