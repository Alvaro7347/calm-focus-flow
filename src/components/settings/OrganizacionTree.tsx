/**
 * OrganizacionTree
 * ---------------------------------------------------------------------------
 * Vista jerárquica de la estructura organizacional del usuario:
 * Área → Proyecto → Subproyecto.
 *
 * Alcance actual:
 *  - Mostrar la jerarquía completa cargada desde Supabase.
 *  - Expandir / contraer nodos con animación suave.
 *  - Renombrar y archivar cualquier nodo desde `OrganizacionActions` (⋯).
 *    Archivar es un soft-delete: el nodo y sus tareas asociadas se
 *    ocultan automáticamente de Sidebar, FOCO, Calendario y Tablero
 *    gracias al filtrado por `archived_at` en cadena que hacen
 *    `taskService` y `tableroService`.
 *
 * Fuera de alcance (preparado, no implementado):
 *  - Eliminar definitivamente / colores / compartir / reordenar / IA.
 *
 * Reactividad:
 *  - El árbol se reconstruye a partir de `fetchAreaTree` (Supabase, RLS)
 *    bajo la queryKey ["organizacion"]. `OrganizacionActions` invalida
 *    esa clave más `TASK_INVALIDATION_KEYS` (["focus"], ["calendar"],
 *    ["tablero"], ["areas","nav"]) tras cada mutación para mantener la
 *    consistencia entre pantallas sin recargar.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, FolderOpen, Hash, Layers } from "lucide-react";
import { fetchAreaTree, type AreaNode, type ProyectoNode, type SubproyectoNode } from "@/services/tableroService";
import { useBootstrapReady } from "@/lib/bootstrapContext";
import {
  OrganizacionActions,
  type OrgNodeType,
} from "@/components/settings/OrganizacionActions";
import { getProjectColor } from "@/lib/projectIdentity";

export const ORGANIZACION_QUERY_KEY = ["organizacion"] as const;

interface RowProps {
  id: string;
  label: string;
  type: OrgNodeType;
  depth: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  count?: number;
  /** Sólo aplica a `type === "project"`: slug de la paleta CalmApp. */
  color?: string | null;
}

function NodeRow({
  id,
  label,
  type,
  depth,
  expandable,
  expanded,
  onToggle,
  count,
  color,
}: RowProps) {
  // Para proyectos, el icono se reemplaza por un punto de color
  // que representa la identidad visual del proyecto.
  const Icon = type === "subproject" ? Hash : expanded ? FolderOpen : Folder;
  const iconColor =
    type === "area"
      ? "text-indigo-600"
      : type === "project"
        ? "text-slate-400"
        : "text-slate-400";

  const projectColor = type === "project" ? getProjectColor(color) : null;

  const paddingLeft = 16 + depth * 20;

  const inner = (
    <>
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-400"
        aria-hidden
      >
        {expandable ? (
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
          />
        ) : null}
      </span>
      {projectColor ? (
        <span
          aria-hidden
          className={`h-2.5 w-2.5 rounded-full shrink-0 ${projectColor.dot}`}
          title={`Color: ${projectColor.label}`}
        />
      ) : (
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
        {label}
      </span>
      {typeof count === "number" ? (
        <span className="shrink-0 text-xs text-slate-400 tabular-nums">
          {count}
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className="group flex items-center pr-2 hover:bg-slate-50 transition-colors"
      style={{ paddingLeft }}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex flex-1 min-w-0 items-center gap-2.5 py-2.5 pr-2 text-left"
        >
          {inner}
        </button>
      ) : (
        <div className="flex flex-1 min-w-0 items-center gap-2.5 py-2.5 pr-2">
          {inner}
        </div>
      )}
      <OrganizacionActions id={id} type={type} name={label} color={color} />
    </div>
  );
}

function SubprojectRow({ sub, depth }: { sub: SubproyectoNode; depth: number }) {
  return <NodeRow id={sub.id} label={sub.nombre} type="subproject" depth={depth} />;
}

function ProjectRow({ project, depth }: { project: ProyectoNode; depth: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = project.subproyectos.length > 0;
  return (
    <>
      <NodeRow
        id={project.id}
        label={project.nombre}
        type="project"
        depth={depth}
        expandable={hasChildren}
        expanded={open}
        onToggle={() => setOpen((v) => !v)}
        count={project.subproyectos.length || undefined}
        color={project.color}
      />

      {hasChildren && open ? (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {project.subproyectos.map((s) => (
            <SubprojectRow key={s.id} sub={s} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function AreaRow({ area }: { area: AreaNode }) {
  const [open, setOpen] = useState(true);
  const hasChildren = area.proyectos.length > 0;
  return (
    <div>
      <NodeRow
        id={area.id}
        label={area.nombre}
        type="area"
        depth={0}
        expandable={hasChildren}
        expanded={open}
        onToggle={() => setOpen((v) => !v)}
        count={area.proyectos.length || undefined}
      />

      {hasChildren && open ? (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {area.proyectos.map((p) => (
            <ProjectRow key={p.id} project={p} depth={1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function OrganizacionTree() {
  const ready = useBootstrapReady();
  const { data, isLoading, isError } = useQuery({
    queryKey: ORGANIZACION_QUERY_KEY,
    queryFn: fetchAreaTree,
    staleTime: 60_000,
    enabled: ready,
  });

  const stats = useMemo(() => {
    const tree = data ?? [];
    let projects = 0;
    let subprojects = 0;
    for (const a of tree) {
      projects += a.proyectos.length;
      for (const p of a.proyectos) subprojects += p.subproyectos.length;
    }
    return { areas: tree.length, projects, subprojects };
  }, [data]);

  return (
    <div className="space-y-4">
      <section className="flex gap-2">
        <Stat label="Áreas" value={stats.areas} />
        <Stat label="Proyectos" value={stats.projects} />
        <Stat label="Subproyectos" value={stats.subprojects} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {!ready || isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            Cargando…
          </div>
        ) : isError ? (
          <div className="px-4 py-10 text-center text-sm text-rose-600">
            No pudimos cargar la organización.
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Layers className="mx-auto h-6 w-6 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-900">
              Sin áreas todavía
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Crea tu primera Área desde "Crear tarea".
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data!.map((area) => (
              <AreaRow key={area.id} area={area} />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400 px-1">
        Archivar oculta un elemento y sus tareas de FOCO, Calendario y Tablero, sin borrar historial.
      </p>
    </div>
  );
}
