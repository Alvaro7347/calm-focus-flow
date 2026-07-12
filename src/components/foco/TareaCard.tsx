/**
 * ========================================================
 * TareaCard (FOCO)
 *
 * Card individual de tarea en la pantalla FOCO. Al hacer
 * clic abre el TaskDetailSheet (modo edit) sobre la misma
 * pantalla, sin navegar ni cambiar la URL. Al cerrarse, el
 * usuario permanece en FOCO exactamente donde estaba.
 * ========================================================
 */
import { useState } from "react";
import type { Tarea } from "@/types/tarea";
import { TaskDetailSheet } from "@/components/TaskDetail";
import { getProjectColor } from "@/lib/projectIdentity";

interface Props {
  tarea: Tarea;
}

function Breadcrumb({ tarea }: Props) {
  const parts = [tarea.area, tarea.proyecto, tarea.subproyecto].filter(Boolean);
  const color = getProjectColor(tarea.proyectoColor);
  return (
    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
      {tarea.proyecto ? (
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${color.dot}`}
        />
      ) : null}
      <span className="truncate">{parts.join(" / ")}</span>
    </div>
  );
}

export function TareaCard({ tarea }: Props) {
  const [open, setOpen] = useState(false);
  const areaSwatch = getProjectColor(tarea.proyectoColor);
  // Barra lateral con el color heredado del Área: hace visible en FOCO
  // a qué Área pertenece cada tarea sin añadir carga visual.
  const base = `w-full text-left rounded-xl border border-slate-200 border-l-4 ${areaSwatch.border} bg-white p-4 transition-shadow hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300`;

  const inner = (() => {
    if (tarea.categoriaFoco === "hoy" || tarea.categoriaFoco === "atrasados") {
      const leftLabel =
        tarea.categoriaFoco === "atrasados"
          ? formatShortDate(tarea.fechaProgramada)
          : tarea.horaInicio;
      return (
        <div className="flex gap-4">
          <div className="text-sm text-slate-500 w-12 shrink-0 pt-0.5">{leftLabel}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 leading-snug">{tarea.titulo}</div>
            <Breadcrumb tarea={tarea} />
            {tarea.categoriaFoco === "atrasados" && (
              <div className="text-xs text-rose-500 mt-1">Atrasada</div>
            )}
          </div>
        </div>
      );
    }
    if (tarea.categoriaFoco === "esta_semana") {
      return (
        <div className="flex gap-4">
          <div className="text-sm text-slate-500 w-12 shrink-0 pt-0.5">{tarea.diaEtiqueta}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 leading-snug">{tarea.titulo}</div>
            <Breadcrumb tarea={tarea} />
          </div>
        </div>
      );
    }
    if (tarea.categoriaFoco === "esperando") {
      return (
        <>
          <div className="text-sm font-semibold text-slate-900 leading-snug">{tarea.titulo}</div>
          <Breadcrumb tarea={tarea} />
        </>
      );
    }
    return (
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 leading-snug">{tarea.titulo}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${areaSwatch.dot}`}
            />
            <span className="truncate">{tarea.area}</span>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400 leading-tight shrink-0">
          <div>Sin actividad</div>
          <div>hace {tarea.diasSinActividad} días</div>
        </div>
      </div>
    );
  })();

  return (
    <>
      <button type="button" className={base} onClick={() => setOpen(true)}>
        {inner}
      </button>
      <TaskDetailSheet open={open} onOpenChange={setOpen} mode="edit" taskId={tarea.id} />
    </>
  );
}
