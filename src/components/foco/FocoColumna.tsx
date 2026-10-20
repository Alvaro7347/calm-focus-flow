/**
 * ========================================================
 * FocoColumna — una columna de FOCO (Hoy, Atrasados, …)
 *
 * En computador (xl) la pantalla funciona como tablero: todas las
 * columnas caben a lo ancho y cada una hace scroll por dentro, con su
 * encabezado siempre visible. En celular y tablet se apilan como antes.
 *
 * - `agruparPorDia`: agrupa las tarjetas bajo un encabezado por día
 *   ("Mar 20 · 8") en vez de repetir el día en cada tarjeta. Se usa en
 *   "Esta semana", que suele tener muchas actividades.
 * - `scroll={false}`: la columna no hace scroll propia (cuando va
 *   apilada con otra en la misma celda y el scroll lo hace el grupo).
 * ========================================================
 */
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import type { Tarea } from "@/types/tarea";
import { TareaCard } from "./TareaCard";

interface Props {
  numero: number;
  titulo: string;
  subtitulo: string;
  icono: ReactNode;
  descripcion: string;
  tareas: Tarea[];
  agruparPorDia?: boolean;
  scroll?: boolean;
}

/** Agrupa tareas consecutivas con la misma etiqueta de día (ya vienen ordenadas). */
function agrupar(tareas: Tarea[]): { dia: string; items: Tarea[] }[] {
  const grupos: { dia: string; items: Tarea[] }[] = [];
  for (const t of tareas) {
    const dia = t.diaEtiqueta ?? "Sin día";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.items.push(t);
    else grupos.push({ dia, items: [t] });
  }
  return grupos;
}

export function FocoColumna({
  numero,
  titulo,
  subtitulo,
  icono,
  descripcion,
  tareas,
  agruparPorDia = false,
  scroll = true,
}: Props) {
  return (
    <section className={`flex min-w-0 flex-col ${scroll ? "xl:h-full xl:min-h-0" : ""}`}>
      <header className="mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-slate-400" aria-hidden>
            {icono}
          </span>
          <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 px-2 text-xs font-semibold tabular-nums text-indigo-600">
            {tareas.length}
          </span>
          <h2 className="truncate text-base font-semibold text-slate-900 xl:text-[17px]">
            {`${numero}. ${titulo}`}
          </h2>
          <button
            type="button"
            aria-label={descripcion}
            title={descripcion}
            className="shrink-0 text-slate-300 hover:text-slate-500"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{subtitulo}</p>
      </header>

      <div
        className={
          scroll
            ? "space-y-2 xl:-mr-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain xl:pr-2 xl:pb-4"
            : "space-y-2"
        }
      >
        {tareas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            Nada por aquí.
          </p>
        ) : agruparPorDia ? (
          agrupar(tareas).map((g) => (
            <div key={g.dia} className="space-y-2">
              <p className="sticky top-0 z-10 -mx-0.5 bg-white/95 px-0.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur first:pt-0">
                {g.dia} · {g.items.length}
              </p>
              {g.items.map((t) => (
                <TareaCard key={t.id} tarea={t} ocultarDia />
              ))}
            </div>
          ))
        ) : (
          tareas.map((t) => <TareaCard key={t.id} tarea={t} />)
        )}
      </div>
    </section>
  );
}
