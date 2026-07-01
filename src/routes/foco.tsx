import { createFileRoute } from "@tanstack/react-router";
import { Clock, Calendar, Hourglass, TrendingUp, Target, Filter } from "lucide-react";
import { FocoColumna } from "@/components/foco/FocoColumna";
import { tareasFoco } from "@/data/mockFocus";

export const Route = createFileRoute("/foco")({
  head: () => ({
    meta: [
      { title: "FOCO — CalmApp" },
      { name: "description", content: "Lo que necesita tu foco total. Suelta lo que te pesa y avanza en lo importante." },
    ],
  }),
  component: FocoPage,
});

function FocoPage() {
  const hoy = tareasFoco.filter((t) => t.categoriaFoco === "hoy");
  const semana = tareasFoco.filter((t) => t.categoriaFoco === "esta_semana");
  const esperando = tareasFoco.filter((t) => t.categoriaFoco === "esperando");
  const sinMov = tareasFoco.filter((t) => t.categoriaFoco === "sin_movimiento");

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Target className="h-5 w-5" />
            </span>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">FOCO</h1>
          </div>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            Lo que necesita tu foco total. Suelta lo que te pesa y avanza en lo importante.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Filter className="h-4 w-4" />
          Filtros
        </button>
      </div>

      {/* Columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <FocoColumna
          numero={1}
          titulo="Hoy"
          subtitulo="Agendado para hoy + todo lo vencido"
          descripcion="Tareas agendadas para hoy, incluyendo lo vencido de días anteriores."
          icono={<Clock className="h-5 w-5" />}
          tareas={hoy}
        />
        <FocoColumna
          numero={2}
          titulo="Esta semana"
          subtitulo="Lo agendado el resto de la semana"
          descripcion="Tareas programadas para el resto de la semana."
          icono={<Calendar className="h-5 w-5" />}
          tareas={semana}
        />
        <FocoColumna
          numero={3}
          titulo="Esperando"
          subtitulo="Tareas en espera o bloqueadas"
          descripcion="Tareas detenidas a la espera de una respuesta o acción externa."
          icono={<Hourglass className="h-5 w-5" />}
          tareas={esperando}
        />
        <FocoColumna
          numero={4}
          titulo="Sin movimiento"
          subtitulo="Tareas sin actividad reciente"
          descripcion="Tareas que llevan varios días sin ningún avance."
          icono={<TrendingUp className="h-5 w-5" />}
          tareas={sinMov}
        />
      </div>

      {/* Pie */}
      <div className="mt-16 flex flex-col items-center text-center">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden className="text-emerald-400/70">
          <path d="M24 42 C24 30 18 22 10 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M24 42 C24 32 30 24 38 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M14 22 Q12 16 16 12 Q20 16 18 22 Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          <path d="M34 24 Q36 18 32 14 Q28 18 30 24 Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        </svg>
        <p className="mt-3 text-sm font-semibold text-slate-700">Menos ruido, más claridad.</p>
        <p className="text-sm text-slate-500">Enfócate en lo que realmente impulsa tu día.</p>
      </div>
    </div>
  );
}
