/**
 * ========================================================
 * Componente: CompletadosSection
 *
 * Historial de Proyectos y Objetivos completados del Área
 * (archivados al 100 %), con fechas de inicio y término y la
 * opción de reabrir. Las Metas completadas se ven dentro de su
 * Objetivo (no se archivan).
 *
 * Datos: `completionService.fetchCompletedHistory`. La queryKey
 * cuelga de ["tablero"], así que se refresca junto al Tablero.
 * ========================================================
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight } from "lucide-react";
import {
  fetchCompletedHistory,
  reopenObjective,
  reopenProject,
  type CompletedItem,
} from "@/services/completionService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

export function CompletadosSection({ areaId }: { areaId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data } = useQuery<CompletedItem[]>({
    queryKey: ["tablero", "completados", areaId],
    queryFn: () => fetchCompletedHistory(areaId),
  });

  const items = data ?? [];
  if (items.length === 0) return null;

  async function reabrir(item: CompletedItem) {
    setBusyId(item.id);
    try {
      if (item.kind === "project") await reopenProject(item.id);
      else await reopenObjective(item.id);
      await invalidateActivityGraph(qc);
      toast.success(`"${item.name}" volvió a estar activo.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reabrir.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700"
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
        Completados ({items.length})
      </button>

      {open ? (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {items.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="flex items-start gap-3 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.kind === "project" ? "Proyecto" : "Objetivo"} · {fmtFecha(item.startedAt)} →{" "}
                  {fmtFecha(item.finishedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void reabrir(item)}
                disabled={busyId === item.id}
                className="shrink-0 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
              >
                Reabrir
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
