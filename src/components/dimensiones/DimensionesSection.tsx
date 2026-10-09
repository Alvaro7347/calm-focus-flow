/**
 * ========================================================
 * DimensionesSection — Dimensiones de un Área en el Tablero
 *
 *   ÁREA
 *   └── DIMENSIÓN (desplegable)
 *         ├── Proyectos  ├── Objetivos  ├── Hábitos  ├── Rutinas
 *         └── Tareas directas
 *
 * - "+ Dimensión" crea una Dimensión (sólo el usuario las crea).
 * - Menú de cada Dimensión: Renombrar · Archivar (DimensionActions,
 *   compartido con Ajustes → Organización).
 * - Archivar con elementos: se pregunta en el momento si mantenerla
 *   o mover sus elementos a "Sin dimensión" y archivarla.
 * - Creación rápida dentro de la Dimensión: reutiliza CrearNodoDialog
 *   (Proyecto/Objetivo/Hábito) y TaskDetailSheet (Tarea directa).
 * ========================================================
 */
import { useState } from "react";
import { ChevronRight, Layers, Plus } from "lucide-react";
import { ProyectoAccordion } from "@/components/tablero/ProyectoAccordion";
import { ObjetivoAccordion } from "@/components/tablero/ObjetivoAccordion";
import { HabitoRow } from "@/components/tablero/HabitoRow";
import { TareaRow } from "@/components/tablero/TareaRow";
import { CrearNodoDialog } from "@/components/settings/CrearNodoDialog";
import { TaskDetailSheet } from "@/components/TaskDetail";
import { RutinaRow } from "@/components/rutinas/RutinaRow";
import { RutinaDialog } from "@/components/rutinas/RutinaDialog";
import type { AreaNode, DimensionNode } from "@/services/tableroService";
import { DimensionMenu, NewDimensionButton } from "./DimensionActions";

interface Props {
  area: AreaNode;
  /** Slugs de la URL para abrir acordeones (mismo criterio del Tablero). */
  proyecto?: string;
  subproyecto?: string;
  objetivo?: string;
  meta?: string;
}

export function DimensionesSection({ area, proyecto, subproyecto, objetivo, meta }: Props) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dimensiones
        </h2>
        <NewDimensionButton areaId={area.id} />
      </div>

      {area.dimensiones.length === 0 ? (
        <p className="text-sm text-slate-500">
          Las dimensiones son partes permanentes de esta área (por ejemplo, Ventas o Salud). Todavía
          no tiene ninguna.
        </p>
      ) : (
        <div className="space-y-3">
          {area.dimensiones.map((d) => (
            <DimensionCard
              key={d.id}
              area={area}
              dim={d}
              proyecto={proyecto}
              subproyecto={subproyecto}
              objetivo={objetivo}
              meta={meta}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------

function DimensionCard({
  area,
  dim,
  proyecto,
  subproyecto,
  objetivo,
  meta,
}: {
  area: AreaNode;
  dim: DimensionNode;
  proyecto?: string;
  subproyecto?: string;
  objetivo?: string;
  meta?: string;
}) {
  const proyectos = area.proyectos.filter((p) => p.dimensionId === dim.id);
  const objetivos = area.objetivos.filter((o) => o.dimensionId === dim.id);
  const habitos = area.habitos.filter((h) => h.dimensionId === dim.id);
  const rutinas = (area.rutinas ?? []).filter((r) => r.dimensionId === dim.id);
  const tareas = [...dim.tareas].sort(
    (a, b) => Number(!!a.completada || !!a.noHecha) - Number(!!b.completada || !!b.noHecha),
  );

  // Abierta por defecto si la URL apunta a algo que vive dentro.
  const containsUrlTarget =
    proyectos.some((p) => p.slug === proyecto) || objetivos.some((o) => o.slug === objetivo);
  const [open, setOpen] = useState(containsUrlTarget);
  const [newTask, setNewTask] = useState(false);

  const empty =
    proyectos.length + objetivos.length + habitos.length + rutinas.length + tareas.length === 0;
  const resumen = [
    proyectos.length ? `${proyectos.length} proy.` : null,
    objetivos.length ? `${objetivos.length} obj.` : null,
    habitos.length ? `${habitos.length} háb.` : null,
    rutinas.length ? `${rutinas.length} rut.` : null,
    dim.tareasPendientes ? `${dim.tareasPendientes} tareas` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[44px] flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <Layers className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate text-sm font-medium text-slate-800">{dim.nombre}</span>
          <span className="ml-auto shrink-0 pl-2 text-xs text-slate-400">{resumen || "Vacía"}</span>
        </button>
        <DimensionMenu dimension={dim} areaName={area.nombre} />
      </div>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 px-3 pb-3 pt-3">
          {empty ? (
            <p className="text-xs text-slate-500">
              Esta dimensión está vacía. Agrega lo que corresponda: no necesita tener de todo.
            </p>
          ) : null}

          {proyectos.length > 0 && (
            <Group title="Proyectos">
              {proyectos.map((p) => (
                <ProyectoAccordion
                  key={p.slug}
                  areaSlug={area.slug}
                  proyecto={p}
                  open={proyecto === p.slug}
                  openSubproyectoSlug={proyecto === p.slug ? subproyecto : undefined}
                />
              ))}
            </Group>
          )}

          {objetivos.length > 0 && (
            <Group title="Objetivos">
              {objetivos.map((o) => (
                <ObjetivoAccordion
                  key={o.slug}
                  areaSlug={area.slug}
                  objetivo={o}
                  open={objetivo === o.slug}
                  openMetaSlug={objetivo === o.slug ? meta : undefined}
                />
              ))}
            </Group>
          )}

          {habitos.length > 0 && (
            <Group title="Hábitos">
              {habitos.map((h) => (
                <HabitoRow key={h.id} habito={h} />
              ))}
            </Group>
          )}

          {rutinas.length > 0 && (
            <Group title="Rutinas">
              {rutinas.map((r) => (
                <RutinaRow key={r.id} rutina={r} />
              ))}
            </Group>
          )}

          {tareas.length > 0 && (
            <Group title="Tareas">
              <ul className="px-1">
                {tareas.map((t) => (
                  <TareaRow key={t.id} tarea={t} />
                ))}
              </ul>
            </Group>
          )}

          {/* Creación rápida dentro de la Dimensión */}
          <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setNewTask(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Tarea
            </button>
            <CrearNodoDialog
              type="project"
              parentId={area.id}
              dimensionId={dim.id}
              triggerLabel="Proyecto"
            />
            <CrearNodoDialog
              type="objective"
              parentId={area.id}
              dimensionId={dim.id}
              triggerLabel="Objetivo"
            />
            <CrearNodoDialog
              type="habit"
              parentId={area.id}
              dimensionId={dim.id}
              triggerLabel="Hábito"
            />
            <RutinaDialog mode="create" areaId={area.id} dimensionId={dim.id} triggerLabel="Rutina" />
          </div>
        </div>
      ) : null}

      <TaskDetailSheet
        open={newTask}
        onOpenChange={setNewTask}
        mode="create"
        createDefaults={{ areaId: area.id, dimensionId: dim.id }}
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
        {children}
      </div>
    </div>
  );
}
