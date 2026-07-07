/**
 * AfterClarityStep — pantalla final del flujo Aha.
 */
import { Button } from "@/components/ui/button";
import type { AhaFlowSummary } from "@/services/ahaService";

interface Props {
  summary: AhaFlowSummary;
  onGoFoco: () => void;
}

export function AfterClarityStep({ summary, onGoFoco }: Props) {
  const delta = summary.mentalLoadDelta;

  return (
    <section className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
          Listo
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">
          Ya no tienes que sostener todo en la cabeza.
        </h2>
        <p className="text-sm text-slate-500">
          Puedes seguir desde FOCO y avanzar con calma.
        </p>
      </div>

      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-5 space-y-2 text-sm">
        <Row label="Pendientes descargados" value={String(summary.dumpedItemsCount)} />
        <Row label="Tareas creadas" value={String(summary.createdTasksCount)} />
        <Row
          label="Próximos pasos confirmados"
          value={String(summary.confirmedNextStepsCount)}
        />
        <Row
          label="Carga mental antes"
          value={summary.mentalLoadBefore != null ? String(summary.mentalLoadBefore) : "—"}
        />
        <Row
          label="Carga mental después"
          value={summary.mentalLoadAfter != null ? String(summary.mentalLoadAfter) : "—"}
        />
        {delta != null ? (
          <Row
            label="Δ Carga mental (alivio)"
            value={delta > 0 ? `+${delta}` : String(delta)}
            emphasize={delta > 0}
          />
        ) : null}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={onGoFoco}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Ir a FOCO
        </Button>
      </div>
    </section>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span
        className={[
          "font-medium",
          emphasize ? "text-emerald-600" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
