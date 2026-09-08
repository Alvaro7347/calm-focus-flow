/**
 * ========================================================
 * Componente: ProyectoProgresoDialog
 *
 * Responsabilidad:
 * Detalle de un Proyecto: fecha objetivo, visión emocional y
 * progreso (con toggle auto/manual), más la lista de sus Etapas
 * con su propio progreso individual.
 *
 * Progreso "mixto" (ver migración `objetivos_metas_habitos_etapas`):
 * - Modo 'auto': `progress_pct` se recalcula solo en la base de
 *   datos a partir de las tareas completadas (Etapa) o del
 *   promedio de Etapas (Proyecto). Aquí solo se muestra.
 * - Modo 'manual': el usuario fija el % a mano con el input;
 *   el recálculo automático se detiene hasta volver a 'auto'.
 *
 * Se abre desde `ProyectoAccordion`. Al guardar cualquier cambio,
 * invalida ["tablero"] para que el árbol se refresque.
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
import { Button } from "@/components/ui/button";
import type { ProyectoNode, SubproyectoNode } from "@/services/tableroService";
import {
  updateProject,
  setProjectProgressManual,
  resetProjectProgressToAuto,
} from "@/services/projectService";
import {
  setStageProgressManual,
  resetStageProgressToAuto,
} from "@/services/subprojectService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";

interface Props {
  proyecto: ProyectoNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProyectoProgresoDialog({ proyecto, open, onOpenChange }: Props) {
  if (!proyecto) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{proyecto.nombre}</DialogTitle>
          <DialogDescription>Fecha objetivo, visión y progreso del Proyecto.</DialogDescription>
        </DialogHeader>

        <ProyectoCampos proyecto={proyecto} />

        {proyecto.subproyectos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Etapas ({proyecto.subproyectos.length})
            </h4>
            <div className="space-y-4">
              {proyecto.subproyectos.map((etapa) => (
                <EtapaProgreso key={etapa.id} etapa={etapa} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Campos del Proyecto: fecha, visión, progreso.
// ------------------------------------------------------------
function ProyectoCampos({ proyecto }: { proyecto: ProyectoNode }) {
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState(proyecto.fechaObjetivo ?? "");
  const [vision, setVision] = useState(proyecto.visionTexto ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFecha(proyecto.fechaObjetivo ?? "");
    setVision(proyecto.visionTexto ?? "");
  }, [proyecto.id, proyecto.fechaObjetivo, proyecto.visionTexto]);

  async function guardarCampos() {
    setSaving(true);
    try {
      await updateProject(proyecto.id, {
        target_date: fecha || null,
        vision_text: vision.trim() || null,
      });
      await invalidateActivityGraph(queryClient);
      toast.success("Proyecto actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <ProgresoControl
        progresoPct={proyecto.progresoPct}
        modoProgreso={proyecto.modoProgreso}
        onSetManual={async (pct) => {
          await setProjectProgressManual(proyecto.id, pct);
          await invalidateActivityGraph(queryClient);
        }}
        onResetAuto={async () => {
          await resetProjectProgressToAuto(proyecto.id);
          await invalidateActivityGraph(queryClient);
        }}
      />

      <div>
        <Label htmlFor="proyecto-fecha">Fecha objetivo</Label>
        <Input
          id="proyecto-fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          onBlur={guardarCampos}
        />
      </div>

      <div>
        <Label htmlFor="proyecto-vision">
          Visión — ¿cómo se ve/siente llegar a este Proyecto?
        </Label>
        <Textarea
          id="proyecto-vision"
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          onBlur={guardarCampos}
          placeholder="Ej: la nueva academia funcionando, alumnos inscritos, clases grabadas..."
          rows={3}
        />
      </div>

      {saving && <p className="text-xs text-slate-400">Guardando…</p>}
    </div>
  );
}

// ------------------------------------------------------------
// Una Etapa dentro del diálogo: nombre + su propio progreso.
// ------------------------------------------------------------
function EtapaProgreso({ etapa }: { etapa: SubproyectoNode }) {
  const queryClient = useQueryClient();
  return (
    <div className="rounded-md border border-slate-100 p-3">
      <p className="text-sm font-medium text-slate-700 mb-2">{etapa.nombre}</p>
      <ProgresoControl
        progresoPct={etapa.progresoPct}
        modoProgreso={etapa.modoProgreso}
        compact
        onSetManual={async (pct) => {
          await setStageProgressManual(etapa.id, pct);
          await invalidateActivityGraph(queryClient);
        }}
        onResetAuto={async () => {
          await resetStageProgressToAuto(etapa.id);
          await invalidateActivityGraph(queryClient);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Control reutilizable: barra de progreso + toggle auto/manual.
// ------------------------------------------------------------
function ProgresoControl({
  progresoPct,
  modoProgreso,
  onSetManual,
  onResetAuto,
  compact = false,
}: {
  progresoPct: number;
  modoProgreso: "auto" | "manual";
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
      if (checked) {
        await onSetManual(Math.round(progresoPct));
      } else {
        await onResetAuto();
      }
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
