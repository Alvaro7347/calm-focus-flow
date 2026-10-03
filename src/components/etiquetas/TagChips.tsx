/**
 * TagChips — muestra las etiquetas de una actividad en listas
 * (Tablero). Lee un único mapa actividad→etiquetas compartido, así
 * no agrega consultas por fila. Si no hay etiquetas, no muestra nada.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchAllTaskTags, fetchTags } from "@/services/tagService";

export function TagChips({ taskId, max = 2 }: { taskId: string; max?: number }) {
  const { data: map = {} } = useQuery({
    queryKey: ["task-tags-map"],
    queryFn: fetchAllTaskTags,
    staleTime: 60_000,
  });
  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: fetchTags });

  const ids = map[taskId] ?? [];
  if (ids.length === 0) return null;
  const names = ids
    .map((id) => tags.find((t) => t.id === id)?.name)
    .filter((n): n is string => !!n);
  if (names.length === 0) return null;

  return (
    <span className="flex shrink-0 items-center gap-1">
      {names.slice(0, max).map((n) => (
        <span
          key={n}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] leading-none text-slate-500"
        >
          {n}
        </span>
      ))}
      {names.length > max ? (
        <span className="text-[10px] text-slate-400">+{names.length - max}</span>
      ) : null}
    </span>
  );
}
