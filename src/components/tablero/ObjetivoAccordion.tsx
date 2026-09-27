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
import { CheckCircle2, ChevronRight, Gauge, Target } from "lucide-react";
import { isMetaCompletada, type ObjetivoNode } from "@/services/tableroService";
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
  const [verCompletadas, setVerCompletadas] = useState(false);
  // Las Metas completadas (100 % manual) no se archivan: se muestran aparte.
  const metasActivas = objetivo.metas.filter((m) => !isMetaCompletada(m));
  const metasCompletadas = objetivo.metas.filter((m) => isMetaCompletada(m));

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
          {metasActivas.map((meta) => (
            <MetaAccordion
              key={meta.slug}
              areaSlug={areaSlug}
              objetivoSlug={objetivo.slug}
              meta={meta}
              open={openMetaSlug === meta.slug}
            />
          ))}
          {metasActivas.length === 0 && metasCompletadas.length > 0 ? (
            <p className="py-2 text-xs text-slate-500">Todas las metas están completadas.</p>
          ) : null}
          {metasCompletadas.length > 0 ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setVerCompletadas((v) => !v)}
                className="flex items-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Metas completadas ({metasCompletadas.length})
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${verCompletadas ? "rotate-90" : ""}`}
                />
              </button>
              {verCompletadas ? (
                <ul className="space-y-1 pb-1 pl-5">
                  {metasCompletadas.map((m) => (
                    <li
                      key={m.id}
                      className="text-sm text-slate-500 line-through decoration-slate-300"
                    >
                      {m.nombre}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
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
