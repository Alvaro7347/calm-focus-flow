/**
 * ========================================================
 * Archivo: routes/calendario (CalendarioPage)
 *
 * Responsabilidad:
 * Pantalla Calendar. Muestra una sola vista a la vez
 * (Semana o Mes) sobre los eventos entregados por
 * calendarService. La vista activa se persiste en
 * localStorage vía useCalendarView.
 *
 * Utilizado por:
 * - TanStack Router (ruta /calendario).
 *
 * No debe importar datos mock directamente ni acoplarse al
 * origen de datos. calendarService es la única capa que
 * conoce de dónde vienen los eventos, y en el futuro
 * combinará tareas CalmApp con eventos de Google Calendar
 * sin que esta pantalla cambie.
 * ========================================================
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import { getCalendarEvents, type CalendarEvent } from "@/services/calendarService";
import { useCalendarView } from "@/hooks/useCalendarView";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { MonthView } from "@/components/calendar/MonthView";
import { EventDetail } from "@/components/calendar/EventDetail";
import { useIsMobile } from "@/hooks/use-mobile";
import { TaskDetailSheet } from "@/components/TaskDetail";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario — CalmApp" },
      { name: "description", content: "Tus tareas con fecha, sin ruido: una vista tranquila por semana o por mes." },
    ],
  }),
  component: CalendarioPage,
});

/**
 * Clave raíz de la caché de Calendar. Cualquier mutación que pueda
 * afectar a las tareas programadas (crear/editar/archivar) debe
 * invalidar esta key para que Calendar se refresque sin recargar:
 *   queryClient.invalidateQueries({ queryKey: calendarQueryKey })
 */
export const calendarQueryKey = ["calendar"] as const;

function CalendarioPage() {
  const [view, setView] = useCalendarView("semana");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const isMobile = useIsMobile();

  // Rango visible según la vista actual. calendarService devuelve
  // sólo los eventos que solapan con este rango.
  const { from, to } = useMemo(() => {
    if (view === "semana") {
      return {
        from: startOfWeek(anchor, { weekStartsOn: 1 }),
        to: endOfWeek(anchor, { weekStartsOn: 1 }),
      };
    }
    // La vista Mes muestra semanas completas alrededor del mes ancla.
    return {
      from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      to: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    };
  }, [view, anchor]);

  const {
    data: events = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    // Incluimos el rango en la key: cambiar de semana/mes dispara
    // una nueva consulta y evita mezclar rangos en la caché.
    queryKey: [...calendarQueryKey, from.toISOString(), to.toISOString()],
    queryFn: () => getCalendarEvents(from, to),
    staleTime: 15_000,
  });


  const titulo = useMemo(() => {
    if (view === "semana") {
      const ini = startOfWeek(anchor, { weekStartsOn: 1 });
      const fin = endOfWeek(anchor, { weekStartsOn: 1 });
      return `${format(ini, "d MMM", { locale: es })} – ${format(fin, "d MMM yyyy", { locale: es })}`;
    }
    return format(anchor, "MMMM yyyy", { locale: es });
  }, [view, anchor]);

  const step = (dir: 1 | -1) => {
    setAnchor((d) => (view === "semana" ? addDays(d, dir * 7) : addMonths(d, dir)));
  };

  return (
    // pb-40 en mobile: reserva espacio para tab bar + FAB de modo que
    // el botón nunca se superponga a los bloques inferiores del calendario.
    <div className="px-4 md:px-10 py-6 md:py-8 pb-40 md:pb-8">

      <CalendarHeader
        titulo={titulo}
        view={view}
        onChangeView={setView}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setAnchor(new Date())}
      />

      <div className="mt-6">
        {isLoading ? (
          <div className="text-sm text-slate-500">Cargando tu calendario…</div>
        ) : isError ? (
          <div className="text-sm text-destructive">
            No pudimos cargar tu calendario. {error instanceof Error ? error.message : ""}
          </div>
        ) : view === "semana" ? (
          <WeekView anchor={anchor} events={events} onSelectEvent={setSelected} />
        ) : (
          <MonthView anchor={anchor} events={events} onSelectEvent={setSelected} />
        )}
      </div>


      {/* Tareas CalmApp → TaskDetailSheet (edición completa).
          Eventos externos (p. ej. Google Calendar en el futuro) → EventDetail (solo lectura). */}
      <TaskDetailSheet
        open={!!selected && selected.source === "calmapp"}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        mode="edit"
        taskId={selected?.source === "calmapp" ? selected.id : undefined}
      />
      <EventDetail
        event={selected && selected.source !== "calmapp" ? selected : null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
