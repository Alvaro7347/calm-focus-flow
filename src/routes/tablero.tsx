/**
 * ========================================================
 * Pantalla: Tablero
 *
 * Responsabilidad:
 * Centro de organización estructural de CalmApp. Muestra la
 * jerarquía Área → Proyecto → Subproyecto → Tareas para UNA
 * sola área a la vez.
 *
 * Estado de navegación:
 * Vive íntegramente en la URL vía TanStack Router search params:
 *   - area: slug del área activa (obligatorio para ver contenido)
 *   - proyecto: slug del proyecto abierto (0 o 1)
 *   - subproyecto: slug del subproyecto abierto (0 o 1)
 * Esto permite compartir enlaces y restaurar estado con refresh.
 *
 * Origen de datos:
 * - `tableroService.fetchAreaTree()` (Supabase). La pantalla
 *   nunca consulta Supabase directamente ni conoce el origen.
 * - Se lee vía TanStack Query bajo la queryKey ["tablero"], por
 *   lo que al crear tareas u organizar nodos se refresca sin
 *   recargar la página.
 * ========================================================
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAreaTree,
  findAreaBySlug,
  toAreaSummaries,
  type AreaNode,
} from "@/services/tableroService";
import { ProyectoAccordion } from "@/components/tablero/ProyectoAccordion";

interface TableroSearch {
  area?: string;
  proyecto?: string;
  subproyecto?: string;
}

export const Route = createFileRoute("/tablero")({
  head: () => ({ meta: [{ title: "Tablero — CalmApp" }] }),
  validateSearch: (search: Record<string, unknown>): TableroSearch => ({
    area: typeof search.area === "string" ? search.area : undefined,
    proyecto: typeof search.proyecto === "string" ? search.proyecto : undefined,
    subproyecto: typeof search.subproyecto === "string" ? search.subproyecto : undefined,
  }),
  component: TableroPage,
});

function TableroPage() {
  const { area: areaSlug, proyecto, subproyecto } = Route.useSearch();

  const {
    data: tree,
    isLoading,
    isError,
    error,
  } = useQuery<AreaNode[]>({
    queryKey: ["tablero"],
    queryFn: fetchAreaTree,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-10 py-10">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-10 py-10">
        <p className="text-sm text-rose-600">
          No pudimos cargar el Tablero: {error instanceof Error ? error.message : "error desconocido"}.
        </p>
      </div>
    );
  }

  const areas = tree ?? [];

  if (!areaSlug) {
    return <AreaPicker tree={areas} />;
  }

  const area = findAreaBySlug(areas, areaSlug);

  if (!area) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-10 py-10">
        <p className="text-sm text-slate-500">No encontramos esa área.</p>
        <Link to="/tablero" search={{}} className="text-indigo-600 text-sm">
          Ver todas las áreas
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-10 py-8 md:py-10 pb-32 md:pb-16">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {area.nombre}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Organiza y revisa tus proyectos, subproyectos y tareas.
        </p>
      </header>

      {area.proyectos.length === 0 ? (
        <p className="text-sm text-slate-500">Esta área todavía no tiene proyectos.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {area.proyectos.map((p) => (
            <ProyectoAccordion
              key={p.slug}
              areaSlug={area.slug}
              proyecto={p}
              open={proyecto === p.slug}
              openSubproyectoSlug={proyecto === p.slug ? subproyecto : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Fallback cuando /tablero se abre sin `area` en la URL. */
function AreaPicker({ tree }: { tree: AreaNode[] }) {
  const areas = toAreaSummaries(tree);
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-10 py-10 pb-32 md:pb-16">
      <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
        Tablero
      </h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Elige un área para ver sus proyectos, subproyectos y tareas.
      </p>
      {areas.length === 0 ? (
        <p className="text-sm text-slate-500">
          Todavía no hay áreas creadas.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {areas.map((a) => (
            <li key={a.slug}>
              <Link
                to="/tablero"
                search={{ area: a.slug }}
                className="block rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
              >
                <div className="text-sm font-medium text-slate-800">{a.nombre}</div>
                <div className="text-xs text-slate-500 mt-0.5">{a.totalTareas} tareas</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
