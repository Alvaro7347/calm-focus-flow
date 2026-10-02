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
import { ObjetivoAccordion } from "@/components/tablero/ObjetivoAccordion";
import { HabitoRow } from "@/components/tablero/HabitoRow";
import { CompletadosSection } from "@/components/tablero/CompletadosSection";
import { DimensionesSection } from "@/components/dimensiones/DimensionesSection";

interface TableroSearch {
  area?: string;
  proyecto?: string;
  subproyecto?: string;
  objetivo?: string;
  meta?: string;
}

export const Route = createFileRoute("/tablero")({
  head: () => ({ meta: [{ title: "Tablero — CalmApp" }] }),
  validateSearch: (search: Record<string, unknown>): TableroSearch => ({
    area: typeof search.area === "string" ? search.area : undefined,
    proyecto: typeof search.proyecto === "string" ? search.proyecto : undefined,
    subproyecto: typeof search.subproyecto === "string" ? search.subproyecto : undefined,
    objetivo: typeof search.objetivo === "string" ? search.objetivo : undefined,
    meta: typeof search.meta === "string" ? search.meta : undefined,
  }),
  component: TableroPage,
});

function TableroPage() {
  const { area: areaSlug, proyecto, subproyecto, objetivo, meta } = Route.useSearch();

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
          No pudimos cargar el Tablero:{" "}
          {error instanceof Error ? error.message : "error desconocido"}.
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

  const proyectosSinDimension = area.proyectos.filter((p) => !p.dimensionId);
  const objetivosSinDimension = area.objetivos.filter((o) => !o.dimensionId);
  const habitosSinDimension = area.habitos.filter((h) => !h.dimensionId);

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

      {/* Dimensiones: partes permanentes del Área (creadas por el usuario). */}
      <DimensionesSection
        area={area}
        proyecto={proyecto}
        subproyecto={subproyecto}
        objetivo={objetivo}
        meta={meta}
      />

      {/* Lo que no tiene Dimensión: se ve exactamente como antes. */}
      {area.dimensiones.length > 0 && (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400 mb-4 pt-2 border-t border-slate-100">
          Sin dimensión
        </p>
      )}

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Proyectos
      </h2>
      {proyectosSinDimension.length === 0 ? (
        <p className="text-sm text-slate-500">
          {area.dimensiones.length > 0
            ? "No hay proyectos sin dimensión."
            : "Esta área todavía no tiene proyectos."}
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {proyectosSinDimension.map((p) => (
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

      {/* Objetivos: hermano de Proyectos, sección visualmente separada. */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mt-8 mb-3">
        Objetivos
      </h2>
      {objetivosSinDimension.length === 0 ? (
        <p className="text-sm text-slate-500">
          {area.dimensiones.length > 0
            ? "No hay objetivos sin dimensión."
            : "Esta área todavía no tiene objetivos."}
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {objetivosSinDimension.map((o) => (
            <ObjetivoAccordion
              key={o.slug}
              areaSlug={area.slug}
              objetivo={o}
              open={objetivo === o.slug}
              openMetaSlug={objetivo === o.slug ? meta : undefined}
            />
          ))}
        </div>
      )}

      {/* Hábitos: hermano de Proyectos y Objetivos. */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mt-8 mb-3">
        Hábitos
      </h2>
      {habitosSinDimension.length === 0 ? (
        <p className="text-sm text-slate-500">
          {area.dimensiones.length > 0
            ? "No hay hábitos sin dimensión."
            : "Esta área todavía no tiene hábitos."}
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {habitosSinDimension.map((h) => (
            <HabitoRow key={h.id} habito={h} />
          ))}
        </div>
      )}

      {/* Historial: Proyectos y Objetivos completados del Área. */}
      <CompletadosSection areaId={area.id} />
    </div>
  );
}

/** Fallback cuando /tablero se abre sin `area` en la URL. */
function AreaPicker({ tree }: { tree: AreaNode[] }) {
  const areas = toAreaSummaries(tree);
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-10 py-10 pb-32 md:pb-16">
      <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">Tablero</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Elige un área para ver sus proyectos, subproyectos y tareas.
      </p>
      {areas.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay áreas creadas.</p>
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
                <div className="text-xs text-slate-500 mt-0.5">
                  {a.totalTareas === 1 ? "1 tarea" : `${a.totalTareas} tareas`}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
