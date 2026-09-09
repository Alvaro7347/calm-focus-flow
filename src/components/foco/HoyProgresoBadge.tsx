/**
 * ========================================================
 * Componente: HoyProgresoBadge
 *
 * Responsabilidad:
 * Medidor de % de tareas de HOY ya completadas (mismo criterio de
 * "hoy" que la columna Hoy de FOCO: `starts_at` = día local actual,
 * solo `activity_type = 'task'`, excluye eventos).
 * ========================================================
 */
import { useQuery } from "@tanstack/react-query";
import { fetchTodayCompletion } from "@/services/taskService";
import { Progress } from "@/components/ui/progress";

export function HoyProgresoBadge() {
  const { data } = useQuery({
    queryKey: ["focus", "today-completion"],
    queryFn: fetchTodayCompletion,
    staleTime: 15_000,
  });

  if (!data || data.total === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shrink-0">
      <span className="text-xs font-medium text-slate-500">Hoy</span>
      <Progress value={data.pct} className="h-1.5 w-16" />
      <span className="text-xs font-semibold text-slate-700 tabular-nums">
        {data.completadas}/{data.total} · {data.pct}%
      </span>
    </div>
  );
}
