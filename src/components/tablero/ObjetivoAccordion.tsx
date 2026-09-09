/**
 * ========================================================
 * Componente: ObjetivoAccordion
 *
 * Responsabilidad:
 * Acordeón de un Objetivo dentro de un Área en Tablero. Gemelo de
 * `ProyectoAccordion`, pero para el eje Objetivo → Meta → Tareas
 * (hermano de Proyecto → Etapa, no anidado bajo él).
 * ========================================================
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Gauge, Target } from "lucide-react";
import type { ObjetivoNode } from "@/services/tableroService";
import { MetaAccordion } from "./MetaAccordion";
import { ObjetivoProgresoDialog } from "./ObjetivoProgresoDialog";

interface Props {
  areaSlug: string;
  objetivo: ObjetivoNode;
  open: boolean;
  openMetaSlug?: string;
}

export function ObjetivoAccordion({ areaSlug, objetivo, open, openMetaSlug }: Props) {
  const [progresoOpen, setProgresoOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center w-full hover:bg-slate-50 transition-colors">
        <Link
          to="/tablero"
          search={(prev: Record<string, unknown>) => ({
            ...prev,
            area: areaSlug,
            objetivo: open ? undefined : objetivo.slug,
            meta: undefined,
          })}
          resetScroll={false}
          className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3.5 text-left"
        >
          <ChevronRight
            className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <Target className="h-3.5 w-3.5 text-indigo-500 shrink-0" aria-hidden />
          <h3 className="text-[15px] font-semibold text-slate-800 flex-1 truncate">
            {objetivo.nombre}
          </h3>
          <span className="text-xs text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
            {objetivo.totalTareas}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setProgresoOpen(true)}
          className="flex items-center gap-1 pr-4 pl-1 py-3.5 text-xs text-slate-500 hover:text-slate-700 shrink-0"
          title="Ver progreso del objetivo"
        >
          <Gauge className="h-3.5 w-3.5" />
          {Math.round(objetivo.progresoPct)}%
        </button>
      </div>

      {open && (
        <div className="pl-6 pr-3 pb-2 border-l border-slate-100 ml-5 mb-2">
          {objetivo.metas.map((meta) => (
            <MetaAccordion
              key={meta.slug}
              areaSlug={areaSlug}
              objetivoSlug={objetivo.slug}
              meta={meta}
              open={openMetaSlug === meta.slug}
            />
          ))}
        </div>
      )}

      <ObjetivoProgresoDialog
        objetivo={objetivo}
        open={progresoOpen}
        onOpenChange={setProgresoOpen}
      />
    </section>
  );
}
