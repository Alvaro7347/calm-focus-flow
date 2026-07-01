import { format } from "date-fns";
import { es } from "date-fns/locale";
import { X } from "lucide-react";
import type { CalendarEvent } from "@/services/calendarService";
import { areaColor } from "./areaColors";

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
}

/** Bottom sheet simple con el detalle de un evento. Reemplaza al bloque
 * mínimo del calendario, donde sólo se muestra título + color. */
export function EventDetail({ event, onClose }: Props) {
  const open = !!event;
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white shadow-xl transition-transform md:inset-auto md:right-6 md:top-24 md:bottom-auto md:w-96 md:rounded-2xl ${
          open ? "translate-y-0" : "translate-y-full md:translate-y-0 md:opacity-0 md:pointer-events-none"
        }`}
        role="dialog"
        aria-label="Detalle del evento"
      >
        {event && <Body event={event} onClose={onClose} />}
      </div>
    </>
  );
}

function Body({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const c = areaColor(event.area);
  const breadcrumb = [event.area, event.proyecto, event.subproyecto].filter(Boolean).join(" / ");
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} aria-hidden />
          <span className="text-xs font-medium text-slate-500">{event.area}</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <h2 className={`mt-3 text-lg font-semibold leading-snug ${event.completada ? "text-slate-400 line-through" : "text-slate-900"}`}>
        {event.titulo}
      </h2>

      <dl className="mt-5 space-y-3 text-sm">
        <Row label="Cuándo">
          {event.allDay
            ? `${format(event.start, "EEEE d 'de' MMMM", { locale: es })} · Todo el día`
            : `${format(event.start, "EEEE d 'de' MMMM · HH:mm", { locale: es })} – ${format(event.end, "HH:mm")}`}
        </Row>
        {breadcrumb && <Row label="Contexto">{breadcrumb}</Row>}
        <Row label="Origen">{event.source === "calmapp" ? "CalmApp" : "Google Calendar"}</Row>
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-700 capitalize-first">{children}</dd>
    </div>
  );
}
