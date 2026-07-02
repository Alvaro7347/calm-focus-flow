import { ChevronRight, Info } from "lucide-react";
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
}

export function FocoColumna({ numero, titulo, subtitulo, icono, descripcion, tareas }: Props) {
  return (
    <section className="flex flex-col min-w-0">
      <header className="mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400" aria-hidden>{icono}</span>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-50 px-2 text-xs font-semibold text-indigo-600">
            {tareas.length}
          </span>
          <h2 className="text-lg font-semibold text-slate-900">{`${numero}. ${titulo}`}</h2>
          <button
            aria-label={descripcion}
            title={descripcion}
            className="text-slate-300 hover:text-slate-500"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{subtitulo}</p>
      </header>

      <div className="space-y-3">
        {tareas.map((t) => (
          <TareaCard key={t.id} tarea={t} />
        ))}
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Próximamente"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-400 self-start cursor-not-allowed"
      >
        Ver todas ({tareas.length})
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}
