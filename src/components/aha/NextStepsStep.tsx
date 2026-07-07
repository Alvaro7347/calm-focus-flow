/**
 * NextStepsStep — muestra los 3 próximos pasos sugeridos.
 * Cada uno se puede editar, descartar o confirmar.
 */
import { Button } from "@/components/ui/button";
import type { NextStep } from "@/services/ahaService";

interface Props {
  steps: NextStep[];
  onChange: (steps: NextStep[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  submitting?: boolean;
}

export function NextStepsStep({ steps, onChange, onConfirm, onBack, submitting }: Props) {
  const update = (id: string, patch: Partial<NextStep>) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const activeCount = steps.filter((s) => !s.discarded).length;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
          Para partir con calma
        </p>
        <h2 className="text-xl font-semibold text-slate-900">
          Tus primeros pasos.
        </h2>
        <p className="text-sm text-slate-500">
          Crearemos las tareas que confirmaste antes. Estos son los primeros pasos
          sugeridos para partir con calma. Puedes editarlos o descartar los que no
          quieras usar como punto de partida.
        </p>
      </div>

      <ol className="space-y-3">
        {steps.map((s, idx) => (
          <li
            key={s.id}
            className={[
              "rounded-xl border p-4 space-y-2",
              s.discarded
                ? "border-slate-200 bg-slate-50 opacity-60"
                : "border-slate-200 bg-white",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Paso {idx + 1}</span>
              <button
                type="button"
                className="ml-auto text-xs text-slate-500 hover:text-red-600"
                onClick={() => update(s.id, { discarded: !s.discarded })}
              >
                {s.discarded ? "Recuperar" : "Descartar"}
              </button>
            </div>
            <input
              type="text"
              value={s.title}
              disabled={s.discarded}
              onChange={(e) => update(s.id, { title: e.target.value, edited: true })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
              maxLength={200}
            />
          </li>
        ))}
        {steps.length === 0 ? (
          <p className="text-sm text-slate-500">Sin ítems suficientes para sugerir pasos.</p>
        ) : null}
      </ol>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {activeCount} paso{activeCount === 1 ? "" : "s"} activo{activeCount === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={submitting}>
            Atrás
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Confirmar y crear tareas
          </Button>
        </div>
      </div>
    </section>
  );
}
