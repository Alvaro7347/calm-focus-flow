/**
 * ========================================================
 * Componente: HabitoRow
 *
 * Responsabilidad:
 * Fila de un Hábito dentro de un Área en Tablero. A diferencia de
 * Proyecto/Objetivo, un Hábito no tiene hijos que expandir — su
 * interacción principal es marcar "hoy" cumplido/no cumplido.
 * El nombre abre `HabitoDetalleDialog` (razón, futuro deseado,
 * frecuencia, % de cumplimiento del mes).
 * ========================================================
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { HabitoNode } from "@/services/tableroService";
import { toggleHabitLog } from "@/services/habitService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";
import { HabitoDetalleDialog } from "./HabitoDetalleDialog";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HabitoRow({ habito }: { habito: HabitoNode }) {
  const qc = useQueryClient();
  const [detalleOpen, setDetalleOpen] = useState(false);

  const marcar = useMutation({
    mutationFn: (done: boolean) => toggleHabitLog(habito.id, todayIso(), done),
    onSuccess: async () => {
      await invalidateActivityGraph(qc);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el hábito.");
    },
  });

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
        <button
          type="button"
          onClick={() => marcar.mutate(!habito.hoyCumplido)}
          disabled={marcar.isPending}
          aria-pressed={habito.hoyCumplido}
          title={habito.hoyCumplido ? "Marcado hoy — clic para desmarcar" : "Marcar cumplido hoy"}
          className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
            habito.hoyCumplido
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-slate-300 text-transparent hover:border-emerald-400"
          }`}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => setDetalleOpen(true)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-medium text-slate-800 truncate">{habito.nombre}</p>
        </button>

        <span className="text-xs text-slate-400 shrink-0">{habito.cumplimientoPct}% este mes</span>
      </div>

      <HabitoDetalleDialog habito={habito} open={detalleOpen} onOpenChange={setDetalleOpen} />
    </>
  );
}
