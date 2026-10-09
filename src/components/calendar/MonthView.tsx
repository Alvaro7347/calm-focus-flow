/**
 * ========================================================
 * MonthView — Vista mensual como "mapa de carga"
 *
 * En el celular, las casillas del mes son demasiado angostas para
 * leer títulos (patrón común en Todoist, Fantastical, Calendario de
 * Apple y Google Calendar: el mes muestra DENSIDAD y el detalle va
 * en una lista del día elegido). Por eso:
 *
 *  - Arriba, el mes: cada día muestra sus HORAS comprometidas y un
 *    color que se intensifica con la carga; punto naranjo si supera
 *    el límite diario; puntitos por los hábitos esperados ese día
 *    (rellenos = cumplidos).
 *  - Abajo (o al lado en pantallas grandes), la lista del día
 *    seleccionado, en la misma pantalla. Tocar un día la cambia.
 *
 * Horas comprometidas de un día:
 *  - Evento: su horario (fin − inicio).
 *  - Tarea: su duración estimada (sin duración = 0, se avisa).
 *  - "No la hice" / "No fui" no cuenta.
 *
 * Los hábitos se leen del árbol del Tablero (misma query ["tablero"]).
 * ========================================================
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import type { CalendarEvent } from "@/services/calendarService";
import { fetchAreaTree, type AreaNode, type HabitoNode } from "@/services/tableroService";
import { getProjectColor } from "@/lib/projectIdentity";
import { isEvento, scheduleText, typeLabel, ariaTypeLabel } from "@/lib/activityDisplay";
import { TaskDetailSheet } from "@/components/TaskDetail";

/** Sobre este número de horas, el día se marca como sobrecargado. */
const LIMITE_HORAS_DIA = 8;

const DIAS_CORTOS = ["L", "M", "M", "J", "V", "S", "D"];

interface Props {
  anchor: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}

// ------------------------------------------------------------
// Cálculos
// ------------------------------------------------------------

function toLocalDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Minutos comprometidos de una actividad del calendario. */
function minutosDe(e: CalendarEvent): number {
  if (e.tarea?.noHecha || e.noHecha) return 0;
  if (isEvento(e)) {
    const m = (e.end.getTime() - e.start.getTime()) / 60000;
    return m > 0 ? Math.round(m) : 0;
  }
  return e.tarea?.duracionMin ?? 0;
}

/** Sin duración: tareas que no suman horas porque no tienen estimado. */
function sinDuracion(e: CalendarEvent): boolean {
  return !isEvento(e) && !e.noHecha && !e.tarea?.noHecha && !e.tarea?.duracionMin;
}

function nivelCarga(min: number): 0 | 1 | 2 | 3 | 4 {
  const h = min / 60;
  if (h === 0) return 0;
  if (h < 3) return 1;
  if (h < 5) return 2;
  if (h < LIMITE_HORAS_DIA) return 3;
  return 4;
}

const FONDO_NIVEL = ["bg-white", "bg-violet-50", "bg-violet-100", "bg-violet-200", "bg-violet-300"];

/** 90 → "1½h"; 120 → "2h"; 45 → "45m"; 0 → "·". */
function horasCortas(min: number): string {
  if (min === 0) return "·";
  if (min < 60) return `${min}m`;
  const h = min / 60;
  const entero = Math.floor(h);
  const resto = h - entero;
  if (resto >= 0.25 && resto < 0.75) return `${entero}½h`;
  return `${resto >= 0.75 ? entero + 1 : entero}h`;
}

/** 540 → "9 h"; 90 → "1 h 30 min"; 45 → "45 min". */
function horasLargas(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function duracionTexto(e: CalendarEvent): string {
  const m = minutosDe(e);
  return m > 0 ? horasLargas(m) : "";
}

/** ¿Se espera el hábito ese día según su frecuencia? */
function habitoEsperado(h: HabitoNode, d: Date): boolean {
  const dias = h.frecuencia?.diasSemana;
  return !dias || dias.length === 0 || dias.includes(d.getDay());
}

// ------------------------------------------------------------
// Componente
// ------------------------------------------------------------

export function MonthView({ anchor, events, onSelectEvent }: Props) {
  const hoy = new Date();

  // Día seleccionado: hoy si está en el mes visible; si no, el día 1.
  const [seleccionado, setSeleccionado] = useState<Date>(() =>
    isSameMonth(hoy, anchor) ? hoy : startOfMonth(anchor),
  );
  useEffect(() => {
    setSeleccionado((prev) =>
      isSameMonth(prev, anchor) ? prev : isSameMonth(hoy, anchor) ? hoy : startOfMonth(anchor),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.getFullYear(), anchor.getMonth()]);

  const [crearEn, setCrearEn] = useState<string | null>(null);

  // Hábitos activos (misma query del Tablero, sin consultas extra).
  const { data: tree = [] } = useQuery<AreaNode[]>({
    queryKey: ["tablero"],
    queryFn: fetchAreaTree,
    staleTime: 60_000,
  });
  const habitos = useMemo(() => tree.flatMap((a) => a.habitos), [tree]);

  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const fin = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = inicio; d <= fin; d = addDays(d, 1)) out.push(d);
    return out;
  }, [anchor]);

  const eventosDia = (d: Date) =>
    events
      .filter((e) => isSameDay(e.start, d))
      .sort((a, b) => Number(a.allDay) - Number(b.allDay) || a.start.getTime() - b.start.getTime());

  // Carga por día
  const carga = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const k = toLocalDate(e.start);
      map.set(k, (map.get(k) ?? 0) + minutosDe(e));
    }
    return map;
  }, [events]);

  // Resumen del mes visible
  const resumen = useMemo(() => {
    let min = 0;
    let sobrecargados = 0;
    for (const d of dias) {
      if (!isSameMonth(d, anchor)) continue;
      const m = carga.get(toLocalDate(d)) ?? 0;
      min += m;
      if (m >= LIMITE_HORAS_DIA * 60) sobrecargados++;
    }
    return { horas: Math.round(min / 60), sobrecargados };
  }, [dias, carga, anchor]);

  const delDia = eventosDia(seleccionado);
  const minDelDia = carga.get(toLocalDate(seleccionado)) ?? 0;
  const sinDuracionDelDia = delDia.filter(sinDuracion).length;
  const habitosDelDia = habitos.filter((h) => habitoEsperado(h, seleccionado));

  // Sugerencia calma: día más liviano de la misma semana, si el seleccionado está sobrecargado.
  const sugerencia = useMemo(() => {
    if (minDelDia < LIMITE_HORAS_DIA * 60) return null;
    const lunes = startOfWeek(seleccionado, { weekStartsOn: 1 });
    let mejor: { d: Date; m: number } | null = null;
    for (let i = 0; i < 7; i++) {
      const d = addDays(lunes, i);
      if (isSameDay(d, seleccionado) || d < new Date(hoy.toDateString())) continue;
      const m = carga.get(toLocalDate(d)) ?? 0;
      if (!mejor || m < mejor.m) mejor = { d, m };
    }
    return mejor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado, minDelDia, carga]);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_360px] md:items-start">
      {/* ---------------- Mapa del mes ---------------- */}
      <section aria-label="Mapa de carga del mes" className="space-y-3">
        <p className="text-xs text-slate-500">
          {resumen.horas} h comprometidas
          {resumen.sobrecargados > 0
            ? ` · ${resumen.sobrecargados} ${resumen.sobrecargados === 1 ? "día sobrecargado" : "días sobrecargados"}`
            : ""}
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 pb-1.5">
            {DIAS_CORTOS.map((d, i) => (
              <div key={i} className="text-center text-[11px] font-semibold text-slate-500">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dias.map((d) => {
              const enMes = isSameMonth(d, anchor);
              const esHoy = isSameDay(d, hoy);
              const esSel = isSameDay(d, seleccionado);
              const min = carga.get(toLocalDate(d)) ?? 0;
              const nivel = nivelCarga(min);
              const sobre = nivel === 4;
              const hecho = new Set<string>();
              const esperados = habitos.filter((h) => habitoEsperado(h, d));
              for (const h of esperados)
                if (h.diasCumplidos.includes(toLocalDate(d))) hecho.add(h.id);
              const etiquetaHoras = horasCortas(min);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setSeleccionado(d)}
                  aria-pressed={esSel}
                  aria-label={`${format(d, "EEEE d 'de' MMMM", { locale: es })}: ${
                    min === 0 ? "sin horas comprometidas" : horasLargas(min)
                  }${sobre ? ", sobrecargado" : ""}`}
                  className={`relative flex min-h-[60px] flex-col items-center justify-between rounded-xl px-0.5 py-1.5 transition-shadow ${
                    FONDO_NIVEL[nivel]
                  } ${esSel ? "ring-2 ring-slate-900" : esHoy ? "ring-[1.5px] ring-violet-500" : ""} ${
                    enMes ? "" : "opacity-45"
                  }`}
                >
                  <span
                    className={`text-xs ${esHoy || esSel ? "font-extrabold" : "font-semibold"} ${
                      esHoy ? "text-violet-700" : "text-slate-900"
                    }`}
                  >
                    {format(d, "d")}
                  </span>
                  {sobre && (
                    <span
                      aria-hidden
                      className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-orange-600 ring-2 ring-white"
                    />
                  )}
                  <span
                    className={`text-[11px] font-bold ${min === 0 ? "text-slate-400" : "text-slate-900"}`}
                  >
                    {etiquetaHoras}
                  </span>
                  <span className="flex min-h-[4px] flex-wrap justify-center gap-0.5" aria-hidden>
                    {esperados.slice(0, 4).map((h) => (
                      <span
                        key={h.id}
                        className={`h-1 w-1 rounded-full ${
                          hecho.has(h.id) ? "bg-slate-900" : "border border-slate-400"
                        }`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span>Liviano</span>
              {FONDO_NIVEL.slice(1).map((c) => (
                <span key={c} className={`h-2.5 w-3.5 rounded-[3px] ${c}`} />
              ))}
              <span>Cargado</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-600" />+{LIMITE_HORAS_DIA} h
              </span>
              {habitos.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-slate-900" />
                  Hábito
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Día seleccionado ---------------- */}
      <section aria-label="Día seleccionado" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold capitalize text-slate-900">
            {format(seleccionado, "EEEE d", { locale: es })}
          </h2>
          <span className="text-sm font-semibold text-slate-700">
            {minDelDia > 0 ? `${horasLargas(minDelDia)} comprometidas` : "Sin horas comprometidas"}
          </span>
        </div>

        {sugerencia && (
          <div className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-[13px] leading-snug text-orange-900">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-600" aria-hidden />
            <span>
              Este día supera tus {LIMITE_HORAS_DIA} h habituales. ¿Mueves algo al{" "}
              {format(sugerencia.d, "EEEE d", { locale: es })}, que tiene{" "}
              {sugerencia.m > 0 ? horasLargas(sugerencia.m) : "el día libre"}?
            </span>
          </div>
        )}

        {habitosDelDia.length > 0 && (
          <p className="text-xs text-slate-500">
            Hábitos de este día: {habitosDelDia.map((h) => h.nombre).join(" · ")}
          </p>
        )}

        {delDia.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-sm text-slate-600">Día libre.</p>
            <button
              type="button"
              onClick={() => setCrearEn(toLocalDate(seleccionado))}
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-violet-700 hover:bg-violet-50"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Agregar tarea este día
            </button>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
            {delDia.map((e) => {
              const pc = getProjectColor(e.proyectoColor);
              const evento = isEvento(e);
              const sched = scheduleText(e);
              const dur = duracionTexto(e);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(e)}
                    aria-label={`${ariaTypeLabel(e)}: ${e.titulo}${sched ? ` — ${sched}` : ""}`}
                    className={`flex min-h-[52px] w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-slate-50 ${
                      e.completada ? "opacity-60" : ""
                    }`}
                  >
                    <span className="w-12 shrink-0 pt-0.5 text-xs font-bold text-slate-900">
                      {e.allDay ? "Día" : format(e.start, "HH:mm")}
                    </span>
                    <span
                      className={`w-[3px] self-stretch shrink-0 rounded-full ${pc.dot}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-semibold ${
                          e.completada ? "text-slate-400 line-through" : "text-slate-900"
                        }`}
                      >
                        {e.titulo}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        {evento && <CalendarIcon className="h-3 w-3 text-violet-600" aria-hidden />}
                        <span className="truncate">
                          {[e.area, e.proyecto].filter(Boolean).join(" · ") || typeLabel(e)}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-xs font-semibold text-slate-500">
                      {dur || (sinDuracion(e) ? "sin duración" : "")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {sinDuracionDelDia > 0 && (
          <p className="text-xs text-slate-500">
            {sinDuracionDelDia === 1
              ? "1 tarea no tiene duración estimada y no suma horas."
              : `${sinDuracionDelDia} tareas no tienen duración estimada y no suman horas.`}
          </p>
        )}
      </section>

      <TaskDetailSheet
        open={!!crearEn}
        onOpenChange={(o) => !o && setCrearEn(null)}
        mode="create"
        createDefaults={crearEn ? { fecha: crearEn } : undefined}
      />
    </div>
  );
}
