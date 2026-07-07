/**
 * MentalLoadStep — pregunta escala 1..5 para carga mental antes/después.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  phase: "before" | "after";
  question: string;
  onAnswer: (value: number) => void;
  onSkip?: () => void;
  submitting?: boolean;
}

const OPTIONS = [
  { value: 1, label: "1 · Muy baja" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5 · Muy alta" },
];

export function MentalLoadStep({ phase, question, onAnswer, onSkip, submitting }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
          {phase === "before" ? "Punto de partida" : "Cómo te sientes ahora"}
        </p>
        <h2 className="text-xl font-semibold text-slate-900">{question}</h2>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              disabled={submitting}
              className={[
                "rounded-lg border px-3 py-3 text-sm transition text-center",
                active
                  ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              ].join(" ")}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        {onSkip ? (
          <Button variant="ghost" size="sm" onClick={onSkip} disabled={submitting}>
            Saltar
          </Button>
        ) : null}
        <Button
          size="sm"
          onClick={() => selected != null && onAnswer(selected)}
          disabled={selected == null || submitting}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Continuar
        </Button>
      </div>
    </section>
  );
}
