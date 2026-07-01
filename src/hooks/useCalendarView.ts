import { useEffect, useState } from "react";

export type CalendarView = "semana" | "mes";
const KEY = "calmapp.calendar.view";

/** Recuerda la última vista de Calendar (semana | mes) en localStorage. */
export function useCalendarView(defaultView: CalendarView = "semana") {
  const [view, setView] = useState<CalendarView>(defaultView);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "semana" || stored === "mes") setView(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  return [view, setView] as const;
}
