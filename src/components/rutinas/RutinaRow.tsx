/**
 * ========================================================
 * Componente: RutinaRow — fila de una Rutina
 *
 * Nombre, días/hora/duración y la semana en curso de un vistazo
 * (un punto por día: hecha, no hecha, pendiente). Tocar la fila abre
 * RutinaDialog para editarla, ver el cumplimiento del mes o archivarla.
 * Se usa en el Tablero (dentro de la Dimensión) y en Ajustes →
 * Organización (`compact`).
 * ========================================================
 */
import { useState } from "react";
import { Repeat } from "lucide-react";
import { mondayOf } from "@/services/tableroService";
import { describeRoutine, routineWeek, type RutinaNode } from "@/services/routineService";
import { RutinaDialog } from "./RutinaDialog";

export function RutinaRow({
  rutina,
  compact = false,
  indent = 0,
}: {
  rutina: RutinaNode;
  compact?: boolean;
  /** Sangría en px (para Ajustes → Organización). */
  indent?: number;
}) {
  const [open, setOpen] = useState(false);
  const semana = routineWeek(rutina, mondayOf());

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full min-h-[44px] items-center gap-3 text-left transition-colors hover:bg-slate-50 ${
          compact ? "py-2.5 pr-3" : "px-4 py-3"
        }`}
        style={compact ? { paddingLeft: indent } : undefined}
      >
        <Repeat className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">{rutina.nombre}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {describeRoutine(rutina)}
            {!compact && semana.esperadas > 0
              ? ` · Esta semana: ${semana.hechas} de ${semana.esperadas}`
              : ""}
          </span>
        </span>

        {!compact ? (
          <span
            className="flex shrink-0 items-end gap-1"
            aria-label={`Esta semana: ${semana.hechas} de ${semana.esperadas}`}
          >
            {semana.dias.map((d) => (
              <span key={d.fecha} className="flex flex-col items-center gap-0.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    d.estado === "hecha"
                      ? "bg-emerald-500"
                      : d.estado === "no_hecha"
                        ? "bg-rose-300"
                        : !d.esperado
                          ? "border border-dashed border-slate-200 bg-transparent"
                          : d.estado === "pendiente"
                            ? "border-2 border-violet-300 bg-white"
                            : d.futuro
                              ? "bg-slate-100"
                              : "bg-slate-200"
                  }`}
                />
                <span className="text-[9px] leading-none text-slate-400">{d.inicial}</span>
              </span>
            ))}
          </span>
        ) : null}
      </button>

      <RutinaDialog mode="edit" rutina={rutina} open={open} onOpenChange={setOpen} />
    </>
  );
}
