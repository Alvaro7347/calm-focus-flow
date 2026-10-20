/**
 * ========================================================
 * TareaCard (FOCO)
 *
 * Card individual de tarea en la pantalla FOCO. Al hacer
 * clic abre el TaskDetailSheet (modo edit) sobre la misma
 * pantalla, sin navegar ni cambiar la URL. Al cerrarse, el
 * usuario permanece en FOCO exactamente donde estaba.
 *
 * Compacta para que en computador quepan las columnas: la hora o
 * fecha va en una franja angosta a la izquierda (sin cortarse), el
 * título se muestra en máximo 2 líneas (completo al pasar el mouse)
 * y la ruta Área / Proyecto en una línea.
 * ========================================================
 */
import { useState } from "react";
import type { Tarea } from "@/types/tarea";
import { TaskDetailSheet } from "@/components/TaskDetail";
import { getProjectColor } from "@/lib/projectIdentity";

interface Props {
  tarea: Tarea;
  /** En "Esta semana" agrupada por día, el día ya está en el encabezado. */
  ocultarDia?: boolean;
}

function formatShortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function Titulo({ texto }: { texto: string }) {
  return (
    <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900" title={texto}>
      {texto}
    </div>
  );
}

function Breadcrumb({ tarea }: Props) {
  const parts = [tarea.area, tarea.proyecto, tarea.subproyecto].filter(Boolean);
  const color = getProjectColor(tarea.proyectoColor);
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
      {tarea.proyecto ? (
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full shrink-0 ${color.dot}`} />
      ) : null}
      <span className="truncate">{parts.join(" / ")}</span>
    </div>
  );
}

/** Franja izquierda con hora o fecha: angosta y sin saltos de línea. */
function Lateral({ texto, alerta = false }: { texto?: string; alerta?: boolean }) {
  return (
    <div
      className={`w-12 shrink-0 whitespace-nowrap pt-0.5 text-xs tabular-nums ${
        alerta ? "font-medium text-rose-500" : "text-slate-500"
      }`}
    >
      {texto}
    </div>
  );
}

export function TareaCard({ tarea, ocultarDia = false }: Props) {
  const [open, setOpen] = useState(false);
  const areaSwatch = getProjectColor(tarea.proyectoColor);
  // Barra lateral con el color heredado del Área: hace visible en FOCO
  // a qué Área pertenece cada tarea sin añadir carga visual.
  const base = `w-full text-left rounded-xl border border-slate-200 border-l-4 ${areaSwatch.border} bg-white px-3 py-2.5 transition-shadow hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300`;

  const inner = (() => {
    if (tarea.categoriaFoco === "hoy" || tarea.categoriaFoco === "atrasados") {
      const leftLabel =
        tarea.categoriaFoco === "atrasados"
          ? formatShortDate(tarea.fechaProgramada)
          : tarea.horaInicio;
      return (
        <div className="flex gap-2.5">
          {leftLabel ? (
            <Lateral texto={leftLabel} alerta={tarea.categoriaFoco === "atrasados"} />
          ) : null}
          <div className="min-w-0 flex-1">
            <Titulo texto={tarea.titulo} />
            <Breadcrumb tarea={tarea} />
          </div>
        </div>
      );
    }
    if (tarea.categoriaFoco === "esta_semana") {
      // Agrupada por día: a la izquierda va la hora (si tiene); si no, el día.
      const lateral = ocultarDia ? tarea.horaInicio : tarea.diaEtiqueta;
      return (
        <div className="flex gap-2.5">
          {lateral ? <Lateral texto={lateral} /> : null}
          <div className="min-w-0 flex-1">
            <Titulo texto={tarea.titulo} />
            <Breadcrumb tarea={tarea} />
          </div>
        </div>
      );
    }
    if (tarea.categoriaFoco === "esperando") {
      return (
        <>
          <Titulo texto={tarea.titulo} />
          <Breadcrumb tarea={tarea} />
        </>
      );
    }
    return (
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Titulo texto={tarea.titulo} />
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full shrink-0 ${areaSwatch.dot}`} />
            <span className="truncate">{tarea.area}</span>
          </div>
        </div>
        <div className="shrink-0 whitespace-nowrap text-right text-xs leading-tight text-slate-400">
          hace {tarea.diasSinActividad} d
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
