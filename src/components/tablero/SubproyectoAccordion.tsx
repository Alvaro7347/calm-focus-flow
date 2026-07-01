/**
 * ========================================================
 * Componente: SubproyectoAccordion
 *
 * Responsabilidad:
 * Acordeón de un Subproyecto dentro de un Proyecto en Tablero.
 * Solo un Subproyecto abierto por Proyecto (controlado por
 * la URL: search.subproyecto). Al hacer clic alterna el
 * search param y cierra los demás automáticamente.
 *
 * Dependencias:
 * - `SubproyectoNode` (tableroService)
 * - `TareaRow`
 *
 * Preparado para acciones futuras (renombrar, eliminar, crear
 * tarea) — el header expone un slot vacío para menú contextual.
 * ========================================================
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { SubproyectoNode } from "@/services/tableroService";
import { TareaRow } from "./TareaRow";

interface Props {
  areaSlug: string;
  proyectoSlug: string;
  sub: SubproyectoNode;
  open: boolean;
}

export function SubproyectoAccordion({ areaSlug, proyectoSlug, sub, open }: Props) {
  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <Link
        to="/tablero"
        search={(prev: Record<string, unknown>) => ({
          ...prev,
          area: areaSlug,
          proyecto: proyectoSlug,
          subproyecto: open ? undefined : sub.slug,
        })}
        resetScroll={false}
        className="flex items-center gap-2 w-full py-2.5 px-2 text-left hover:bg-slate-50 rounded-md transition-colors"
      >
        <ChevronRight
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="text-sm text-slate-700 flex-1 truncate">{sub.nombre}</span>
        <span className="text-xs text-slate-400">{sub.tareas.length}</span>
      </Link>

      {open && (
        <ul className="pl-6 pr-2 pb-3 space-y-0.5">
          {sub.tareas.map((t) => (
            <TareaRow key={t.id} tarea={t} />
          ))}
        </ul>
      )}
    </div>
  );
}
