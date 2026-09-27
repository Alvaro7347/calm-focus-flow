/**
 * ========================================================
 * Componente: CompletarDialog
 *
 * Flujo de cierre para Proyecto, Meta u Objetivo:
 *   1. Confirmación: qué va a pasar (tareas pendientes que se
 *      marcarán como completadas, eventos futuros que dejarán
 *      de verse).
 *   2. Cierre tranquilo: iniciado / terminado / tareas
 *      completadas y la visión, si existe.
 *
 * Lógica en `completionService` (sin cambios en Supabase).
 * ========================================================
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  completeItem,
  getCompletionPreview,
  type CompletableKind,
  type CompletionPreview,
} from "@/services/completionService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";

const LABELS: Record<CompletableKind, { el: string; titulo: string }> = {
  project: { el: "el proyecto", titulo: "Completar proyecto" },
  goal: { el: "la meta", titulo: "Completar meta" },
  objective: { el: "el objetivo", titulo: "Completar objetivo" },
};

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

interface Props {
  kind: CompletableKind;
  id: string;
  nombre: string;
  vision: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama al cerrar la pantalla final (p. ej. para cerrar el diálogo padre). */
  onCompleted?: () => void;
}

export function CompletarDialog({
  kind,
  id,
  nombre,
  vision,
  open,
  onOpenChange,
  onCompleted,
}: Props) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<CompletionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ finishedAt: string; total: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setDone(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCompletionPreview(kind, id)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo revisar el estado antes de cerrar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, id]);

  async function confirmar() {
    if (!preview) return;
    setBusy(true);
    try {
      await completeItem(kind, id);
      setDone({
        finishedAt: new Date().toISOString(),
        total: preview.completedTasks + preview.pendingTasks,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }

  async function cerrarFinal() {
    await invalidateActivityGraph(qc);
    onOpenChange(false);
    onCompleted?.();
  }

  const l = LABELS[kind];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Si ya se completó, cerrar por fuera equivale a "Cerrar".
        if (!v && done) void cerrarFinal();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="space-y-6 py-2 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <div className="space-y-1">
              <DialogTitle className="text-xl">{nombre}</DialogTitle>
              <DialogDescription>
                {kind === "goal" ? "Meta completada." : "Completado. Iniciado y terminado."}
              </DialogDescription>
            </div>

            <div className="grid grid-cols-3 gap-2 text-left">
              <div className="rounded-xl border p-3">
                <p className="text-[11px] text-muted-foreground">Iniciado</p>
                <p className="mt-1 text-sm font-medium">{fmtFecha(preview?.createdAt ?? null)}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-[11px] text-muted-foreground">Terminado</p>
                <p className="mt-1 text-sm font-medium">{fmtFecha(done.finishedAt)}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-[11px] text-muted-foreground">Tareas</p>
                <p className="mt-1 text-sm font-medium">{done.total}</p>
              </div>
            </div>

            {vision ? (
              <p className="border-l-2 border-emerald-500/40 pl-3 text-left text-sm italic leading-relaxed text-muted-foreground">
                “{vision}”
              </p>
            ) : null}

            <Button className="w-full" onClick={() => void cerrarFinal()}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{l.titulo}</DialogTitle>
              <DialogDescription>{nombre}</DialogDescription>
            </DialogHeader>

            {loading || !preview ? (
              <p className="text-sm text-muted-foreground">Revisando…</p>
            ) : (
              <div className="space-y-3 text-sm leading-relaxed text-foreground/85">
                {preview.pendingTasks > 0 ? (
                  <p>
                    {plural(preview.pendingTasks, "tarea pendiente", "tareas pendientes")} se
                    marcará{preview.pendingTasks === 1 ? "" : "n"} como completada
                    {preview.pendingTasks === 1 ? "" : "s"}.
                  </p>
                ) : (
                  <p>No quedan tareas pendientes.</p>
                )}

                {preview.futureEvents > 0 ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    Tiene {plural(preview.futureEvents, "evento agendado", "eventos agendados")} a
                    futuro. Al completarlo, se archivará{preview.futureEvents === 1 ? "" : "n"} y
                    dejará{preview.futureEvents === 1 ? "" : "n"} de ocupar ese horario en tu
                    Calendario.
                  </p>
                ) : null}

                {kind === "project" ? (
                  <p className="text-muted-foreground">
                    El proyecto saldrá de tus proyectos activos y quedará en Completados, donde
                    puedes reabrirlo si lo necesitas.
                  </p>
                ) : kind === "objective" ? (
                  <p className="text-muted-foreground">
                    También se completarán todas sus metas. El objetivo quedará en Completados,
                    donde puedes reabrirlo si lo necesitas.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    La meta quedará como completada dentro de su objetivo y seguirá sumando a su
                    progreso. Puedes reabrirla si lo necesitas.
                  </p>
                )}
              </div>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={() => void confirmar()} disabled={busy || loading || !preview}>
                {busy ? "Completando…" : `Completar ${l.el.split(" ")[1]}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
