/**
 * ========================================================
 * Componente: HabitoDetalleDialog
 *
 * Responsabilidad:
 * Edición de un Hábito: razón ("¿por qué quiero incorporar esto?"),
 * futuro deseado ("¿qué versión de mí quiero desarrollar?") y
 * frecuencia (días de la semana). El % de cumplimiento se muestra
 * de solo lectura (se calcula en `tableroService`, no aquí).
 * ========================================================
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HabitoNode } from "@/services/tableroService";
import { updateHabit } from "@/services/habitService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";
import type { RecurrenceRule } from "@/types/tarea";
import type { Json } from "@/integrations/supabase/types";

interface Props {
  habito: HabitoNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** [etiqueta, día JS (0=domingo..6=sábado)], en orden Lunes→Domingo. */
const DIAS: Array<[string, number]> = [
  ["L", 1],
  ["M", 2],
  ["M", 3],
  ["J", 4],
  ["V", 5],
  ["S", 6],
  ["D", 0],
];

export function HabitoDetalleDialog({ habito, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [razon, setRazon] = useState(habito?.razon ?? "");
  const [futuro, setFuturo] = useState(habito?.futuroDeseado ?? "");
  const [diasSemana, setDiasSemana] = useState<number[]>(habito?.frecuencia?.diasSemana ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRazon(habito?.razon ?? "");
    setFuturo(habito?.futuroDeseado ?? "");
    setDiasSemana(habito?.frecuencia?.diasSemana ?? []);
  }, [habito?.id, habito?.razon, habito?.futuroDeseado, habito?.frecuencia]);

  if (!habito) return null;

  async function guardar(patch: {
    razon?: string;
    futuro?: string;
    diasSemana?: number[];
  }) {
    if (!habito) return;
    setSaving(true);
    try {
      const nuevaFrecuencia: RecurrenceRule = {
        frecuencia: (patch.diasSemana ?? diasSemana).length > 0 ? "semanal" : "diaria",
        diasSemana: (patch.diasSemana ?? diasSemana).length > 0 ? patch.diasSemana ?? diasSemana : undefined,
      };
      await updateHabit(habito.id, {
        reason_text: (patch.razon ?? razon).trim() || null,
        desired_future_text: (patch.futuro ?? futuro).trim() || null,
        frequency_rule: nuevaFrecuencia as unknown as Json,
      });
      await invalidateActivityGraph(qc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  function toggleDia(dia: number) {
    const next = diasSemana.includes(dia)
      ? diasSemana.filter((d) => d !== dia)
      : [...diasSemana, dia];
    setDiasSemana(next);
    guardar({ diasSemana: next });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{habito.nombre}</DialogTitle>
          <DialogDescription>
            {habito.cumplimientoPct}% de cumplimiento este mes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Frecuencia</Label>
            <div className="flex gap-1.5">
              {DIAS.map(([label, dia], i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDia(dia)}
                  className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                    diasSemana.includes(dia)
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Sin días marcados = todos los días.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="habito-razon">¿Por qué quiero incorporar esto?</Label>
            <Textarea
              id="habito-razon"
              value={razon}
              onChange={(e) => setRazon(e.target.value)}
              onBlur={() => guardar({ razon })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="habito-futuro">¿Qué versión de mí quiero desarrollar?</Label>
            <Textarea
              id="habito-futuro"
              value={futuro}
              onChange={(e) => setFuturo(e.target.value)}
              onBlur={() => guardar({ futuro })}
              rows={2}
            />
          </div>

          {saving && <p className="text-xs text-slate-400">Guardando…</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
