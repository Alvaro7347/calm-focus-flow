/**
 * ========================================================
 * Componente: MetaAccordion
 *
 * Responsabilidad:
 * Acordeón de una Meta dentro de un Objetivo en Tablero. Gemelo de
 * `SubproyectoAccordion`, pero para el eje Objetivo → Meta → Tareas
 * (independiente de Proyecto → Etapa). Solo una Meta abierta por
 * Objetivo, controlado por la URL: search.meta.
 * ========================================================
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { MetaNode } from "@/services/tableroService";
import { TareaRow } from "./TareaRow";

interface Props {
  areaSlug: string;
  objetivoSlug: string;
  meta: MetaNode;
  open: boolean;
}

export function MetaAccordion({ areaSlug, objetivoSlug, meta, open }: Props) {
  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <Link
        to="/tablero"
        search={(prev: Record<string, unknown>) => ({
          ...prev,
          area: areaSlug,
          objetivo: objetivoSlug,
          meta: open ? undefined : meta.slug,
        })}
        resetScroll={false}
        className="flex items-center gap-2 w-full py-2.5 px-2 text-left hover:bg-slate-50 rounded-md transition-colors"
      >
        <ChevronRight
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="text-sm text-slate-700 flex-1 truncate">{meta.nombre}</span>
        <span className="text-xs text-slate-400">{Math.round(meta.progresoPct)}%</span>
        <span className="text-xs text-slate-400">{meta.tareasPendientes}</span>
      </Link>

      {open && (
        <ul className="pl-6 pr-2 pb-3 space-y-0.5">
          {meta.tareas.map((t) => (
            <TareaRow key={t.id} tarea={t} />
          ))}
        </ul>
      )}
    </div>
  );
}
