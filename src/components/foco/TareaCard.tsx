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

interface Props {
  tarea: Tarea;
}

function Breadcrumb({ tarea }: Props) {
  const parts = [tarea.area, tarea.proyecto, tarea.subproyecto].filter(Boolean);
  return <div className="text-xs text-slate-500 mt-1">{parts.join(" / ")}</div>;
}

export function TareaCard({ tarea }: Props) {
  const [open, setOpen] = useState(false);
  const base =
    "w-full text-left rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";

  const inner = (() => {
    if (tarea.categoriaFoco === "hoy") {
      return (
        <div className="flex gap-4">
          <div className="text-sm text-slate-500 w-12 shrink-0 pt-0.5">{tarea.horaInicio}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 leading-snug">{tarea.titulo}</div>
            <Breadcrumb tarea={tarea} />
            {tarea.vencida && (
              <div className="text-xs text-slate-400 mt-1">Pendiente desde ayer</div>
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
          <div className="text-xs text-slate-500 mt-1">{tarea.area}</div>
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
