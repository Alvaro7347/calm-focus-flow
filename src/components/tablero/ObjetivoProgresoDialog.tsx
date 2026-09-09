/**
 * ========================================================
 * Componente: ObjetivoProgresoDialog
 *
 * Responsabilidad:
 * Detalle de un Objetivo: fecha objetivo, visión emocional y
 * progreso (auto/manual), más la lista de sus Metas — cada una con
 * su propio progreso, fecha y visión (a diferencia de la Etapa,
 * la Meta sí tiene visión propia; ver migración
 * `objetivos_metas_habitos_etapas`).
 *
 * Gemelo de `ProyectoProgresoDialog`. Se abre desde
 * `ObjetivoAccordion`. Al guardar, invalida ["tablero"].
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
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ObjetivoNode, MetaNode } from "@/services/tableroService";
import {
  updateObjective,
  setObjectiveProgressManual,
  resetObjectiveProgressToAuto,
  updateGoal,
  setGoalProgressManual,
  resetGoalProgressToAuto,
} from "@/services/objectiveService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";
import type { ProgressMode } from "@/types/tarea";

interface Props {
  objetivo: ObjetivoNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ObjetivoProgresoDialog({ objetivo, open, onOpenChange }: Props) {
  if (!objetivo) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{objetivo.nombre}</DialogTitle>
          <DialogDescription>Fecha objetivo, visión y progreso del Objetivo.</DialogDescription>
        </DialogHeader>

        <ObjetivoCampos objetivo={objetivo} />

        {objetivo.metas.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Metas ({objetivo.metas.length})
            </h4>
            <div className="space-y-4">
              {objetivo.metas.map((meta) => (
                <MetaCampos key={meta.id} meta={meta} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ObjetivoCampos({ objetivo }: { objetivo: ObjetivoNode }) {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(objetivo.fechaObjetivo ?? "");
  const [vision, setVision] = useState(objetivo.visionTexto ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFecha(objetivo.fechaObjetivo ?? "");
    setVision(objetivo.visionTexto ?? "");
  }, [objetivo.id, objetivo.fechaObjetivo, objetivo.visionTexto]);

  async function guardar() {
    setSaving(true);
    try {
      await updateObjective(objetivo.id, {
        target_date: fecha || null,
        vision_text: vision.trim() || null,
      });
      await invalidateActivityGraph(qc);
      toast.success("Objetivo actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <ProgresoControl
        progresoPct={objetivo.progresoPct}
        modoProgreso={objetivo.modoProgreso}
        onSetManual={async (pct) => {
          await setObjectiveProgressManual(objetivo.id, pct);
          await invalidateActivityGraph(qc);
        }}
        onResetAuto={async () => {
          await resetObjectiveProgressToAuto(objetivo.id);
          await invalidateActivityGraph(qc);
        }}
      />

      <div>
        <Label htmlFor="objetivo-fecha">Fecha objetivo</Label>
        <Input
          id="objetivo-fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          onBlur={guardar}
        />
      </div>

      <div>
        <Label htmlFor="objetivo-vision">
          Visión — ¿cómo se vería/sentiría llegar a este Objetivo?
        </Label>
        <Textarea
          id="objetivo-vision"
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          onBlur={guardar}
          rows={3}
        />
      </div>

      {saving && <p className="text-xs text-slate-400">Guardando…</p>}
    </div>
  );
}

function MetaCampos({ meta }: { meta: MetaNode }) {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(meta.fechaObjetivo ?? "");
  const [vision, setVision] = useState(meta.visionTexto ?? "");

  useEffect(() => {
    setFecha(meta.fechaObjetivo ?? "");
    setVision(meta.visionTexto ?? "");
  }, [meta.id, meta.fechaObjetivo, meta.visionTexto]);

  async function guardar() {
    try {
      await updateGoal(meta.id, {
        target_date: fecha || null,
        vision_text: vision.trim() || null,
      });
      await invalidateActivityGraph(qc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la meta.");
    }
  }

  return (
    <div className="rounded-md border border-slate-100 p-3 space-y-2">
      <p className="text-sm font-medium text-slate-700">{meta.nombre}</p>
      <ProgresoControl
        progresoPct={meta.progresoPct}
        modoProgreso={meta.modoProgreso}
        compact
        onSetManual={async (pct) => {
          await setGoalProgressManual(meta.id, pct);
          await invalidateActivityGraph(qc);
        }}
        onResetAuto={async () => {
          await resetGoalProgressToAuto(meta.id);
          await invalidateActivityGraph(qc);
        }}
      />
      <Input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        onBlur={guardar}
        className="h-8 text-xs"
      />
      <Textarea
        value={vision}
        onChange={(e) => setVision(e.target.value)}
        onBlur={guardar}
        placeholder="Visión de esta Meta (opcional)"
        rows={2}
        className="text-xs"
      />
    </div>
  );
}

// ------------------------------------------------------------
// Control reutilizable: barra de progreso + toggle auto/manual.
// (Idéntico al de ProyectoProgresoDialog; se duplica localmente
// para no crear un acoplamiento cruzado Proyecto↔Objetivo por un
// componente tan pequeño.)
// ------------------------------------------------------------
function ProgresoControl({
  progresoPct,
  modoProgreso,
  onSetManual,
  onResetAuto,
  compact = false,
}: {
  progresoPct: number;
  modoProgreso: ProgressMode;
  onSetManual: (pct: number) => Promise<void>;
  onResetAuto: () => Promise<void>;
  compact?: boolean;
}) {
  const [manualPct, setManualPct] = useState(String(Math.round(progresoPct)));
  const [busy, setBusy] = useState(false);
  const esManual = modoProgreso === "manual";

  useEffect(() => {
    setManualPct(String(Math.round(progresoPct)));
  }, [progresoPct]);

  async function toggleModo(checked: boolean) {
    setBusy(true);
    try {
      if (checked) await onSetManual(Math.round(progresoPct));
      else await onResetAuto();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el modo.");
    } finally {
      setBusy(false);
    }
  }

  async function guardarManual() {
    const pct = Math.max(0, Math.min(100, Number(manualPct) || 0));
    setBusy(true);
    try {
      await onSetManual(pct);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el %.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={compact ? "text-xs text-slate-500" : "text-sm text-slate-600"}>
          Progreso
        </span>
        <span className={compact ? "text-xs font-medium" : "text-sm font-medium"}>
          {Math.round(progresoPct)}%
        </span>
      </div>
      <Progress value={progresoPct} className={compact ? "h-1.5" : "h-2"} />

      <div className="flex items-center gap-2 mt-2">
        <Switch checked={esManual} onCheckedChange={toggleModo} disabled={busy} />
        <span className="text-xs text-slate-500">
          {esManual ? "Manual" : "Automático (desde tareas)"}
        </span>

        {esManual && (
          <div className="flex items-center gap-1 ml-auto">
            <Input
              type="number"
              min={0}
              max={100}
              value={manualPct}
              onChange={(e) => setManualPct(e.target.value)}
              onBlur={guardarManual}
              className="h-7 w-16 text-xs"
              disabled={busy}
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
        )}
      </div>
    </div>
  );
}
