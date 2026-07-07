/**
 * BrainDumpStep — descarga libre de pendientes en una sola caja de texto.
 * No pide área/proyecto/subproyecto. No envía el texto a analytics.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onSubmit: (text: string, itemCount: number) => void;
  onBack?: () => void;
  submitting?: boolean;
}

const PLACEHOLDER = `Ej:
Responder correo de cliente
Comprar regalo
Revisar pago pendiente
Preparar clase del jueves
Pedir hora al dentista`;

export function BrainDumpStep({ onSubmit, onBack, submitting }: Props) {
  const [text, setText] = useState("");

  const itemCount = useMemo(
    () => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length,
    [text],
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
          Vacía tu cabeza
        </p>
        <h2 className="text-xl font-semibold text-slate-900">
          Escribe un pendiente por línea.
        </h2>
        <p className="text-sm text-slate-500">
          Pueden ser tareas, preocupaciones, ideas o cosas que no quieres olvidar.
          Mientras más descargues, mejor.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={12}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        disabled={submitting}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {itemCount} {itemCount === 1 ? "línea" : "líneas"}
          {itemCount > 0 && itemCount < 5 ? " · sigue si tienes más" : ""}
        </p>
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack} disabled={submitting}>
              Atrás
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={() => onSubmit(text, itemCount)}
            disabled={itemCount === 0 || submitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Ordenar mi descarga
          </Button>
        </div>
      </div>
    </section>
  );
}
