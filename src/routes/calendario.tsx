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
import {
  addDays,
  addMonths,
  endOfWeek,
  format,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import { getCalendarEvents, type CalendarEvent } from "@/services/calendarService";
import { useCalendarView } from "@/hooks/useCalendarView";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { EventDetail } from "@/components/calendar/EventDetail";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario — CalmApp" },
      { name: "description", content: "Tus tareas con fecha, sin ruido: una vista tranquila por semana o por mes." },
    ],
  }),
  component: CalendarioPage,
});

function CalendarioPage() {
  const [view, setView] = useCalendarView("semana");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const events = useMemo(() => getCalendarEvents(), []);

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
    <div className="px-4 md:px-10 py-6 md:py-8 pb-32 md:pb-8">
      <CalendarHeader
        titulo={titulo}
        view={view}
        onChangeView={setView}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setAnchor(new Date())}
      />

      <div className="mt-6">
        {view === "semana" ? (
          <WeekView anchor={anchor} events={events} onSelectEvent={setSelected} />
        ) : (
          <MonthView anchor={anchor} events={events} onSelectEvent={setSelected} />
        )}
      </div>

      <EventDetail event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
