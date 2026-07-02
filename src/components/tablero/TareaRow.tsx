/**
 * ========================================================
 * Componente: TareaRow
 *
 * Responsabilidad:
 * Representa una tarea individual dentro de un Subproyecto
 * en la pantalla Tablero. Muestra estado, título, prioridad
 * y fecha de vencimiento. Las tareas completadas se muestran
 * tachadas y en gris (permanecen visibles).
 *
 * Dependencias:
 * - Tipo `Tarea` (src/types/tarea)
 *
 * No conoce el origen de los datos: recibe la tarea por props.
 * ========================================================
 */
import { useState } from "react";
import type { Tarea, Priority } from "@/types/tarea";
import { Check, Circle } from "lucide-react";
import { TaskDetailSheet } from "@/components/TaskDetail";

interface Props {
  tarea: Tarea;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
  normal: "Normal",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  alta: "text-rose-600 bg-rose-50",
  media: "text-amber-700 bg-amber-50",
  baja: "text-slate-500 bg-slate-100",
  normal: "text-slate-500 bg-slate-100",
};

function formatFecha(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function TareaRow({ tarea }: Props) {
  const [open, setOpen] = useState(false);
  const completada = !!tarea.completada;
  const priority: Priority = tarea.priority ?? "normal";
  const fecha = formatFecha(tarea.fechaProgramada);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        <span
          aria-hidden
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            completada ? "bg-slate-200 border-slate-200 text-slate-500" : "border-slate-300 text-transparent"
          }`}
        >
          {completada ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
        </span>

        <span
          className={`flex-1 text-sm truncate ${
            completada ? "line-through text-slate-400" : "text-slate-700"
          }`}
        >
          {tarea.titulo}
        </span>

        {priority !== "normal" && !completada && (
          <span className={`text-xs px-2 py-0.5 rounded-md ${PRIORITY_CLASS[priority]}`}>
            {PRIORITY_LABEL[priority]}
          </span>
        )}

        {fecha && (
          <span className={`text-xs ${completada ? "text-slate-300" : "text-slate-500"}`}>
            {fecha}
          </span>
        )}
      </button>
      <TaskDetailSheet open={open} onOpenChange={setOpen} mode="edit" taskId={tarea.id} />
    </li>
  );
}
