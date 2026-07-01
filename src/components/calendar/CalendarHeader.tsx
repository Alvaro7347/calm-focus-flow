import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import type { CalendarView } from "@/hooks/useCalendarView";

interface Props {
  titulo: string;
  view: CalendarView;
  onChangeView: (v: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** Cabecera común a Semana y Mes: título del rango, navegación y switch de vista. */
export function CalendarHeader({ titulo, view, onChangeView, onPrev, onNext, onToday }: Props) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <CalIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
            Calendario
          </h1>
          <p className="text-sm text-slate-500 capitalize">{titulo}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 md:gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <ViewTab active={view === "semana"} onClick={() => onChangeView("semana")}>Semana</ViewTab>
          <ViewTab active={view === "mes"} onClick={() => onChangeView("mes")}>Mes</ViewTab>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            aria-label="Anterior"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onToday}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hoy
          </button>
          <button
            onClick={onNext}
            aria-label="Siguiente"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
