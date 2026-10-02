/**
 * ========================================================
 * DimensionesSection — Dimensiones de un Área en el Tablero
 *
 *   ÁREA
 *   └── DIMENSIÓN (desplegable)
 *         ├── Proyectos  ├── Objetivos  ├── Hábitos  └── Tareas directas
 *
 * - "+ Dimensión" crea una Dimensión (sólo el usuario las crea).
 * - Menú de cada Dimensión: Renombrar · Archivar.
 * - Archivar con elementos: se pregunta en el momento si mantenerla
 *   o mover sus elementos a "Sin dimensión" y archivarla.
 * - Creación rápida dentro de la Dimensión: reutiliza CrearNodoDialog
 *   (Proyecto/Objetivo/Hábito) y TaskDetailSheet (Tarea directa).
 * ========================================================
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Layers, MoreHorizontal, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProyectoAccordion } from "@/components/tablero/ProyectoAccordion";
import { ObjetivoAccordion } from "@/components/tablero/ObjetivoAccordion";
import { HabitoRow } from "@/components/tablero/HabitoRow";
import { TareaRow } from "@/components/tablero/TareaRow";
import { CrearNodoDialog } from "@/components/settings/CrearNodoDialog";
import { TaskDetailSheet } from "@/components/TaskDetail";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";
import type { AreaNode, DimensionNode } from "@/services/tableroService";
import {
  archiveDimensionMovingContents,
  countDimensionContents,
  createDimension,
  renameDimension,
  type DimensionContents,
} from "@/services/dimensionService";

interface Props {
  area: AreaNode;
  /** Slugs de la URL para abrir acordeones (mismo criterio del Tablero). */
  proyecto?: string;
  subproyecto?: string;
  objetivo?: string;
  meta?: string;
}

export function DimensionesSection({ area, proyecto, subproyecto, objetivo, meta }: Props) {
  const qc = useQueryClient();
  const [nameDialog, setNameDialog] = useState<
    { mode: "create" } | { mode: "rename"; dim: DimensionNode } | null
  >(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    dim: DimensionNode;
    contents: DimensionContents | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    await invalidateActivityGraph(qc);
  }

  async function openArchive(dim: DimensionNode) {
    setArchiveTarget({ dim, contents: null });
    try {
      const contents = await countDimensionContents(dim.id);
      setArchiveTarget({ dim, contents });
    } catch {
      toast.error("No se pudo revisar el contenido de la dimensión.");
      setArchiveTarget(null);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setBusy(true);
    try {
      await archiveDimensionMovingContents(archiveTarget.dim.id);
      await refresh();
      toast.success(`"${archiveTarget.dim.nombre}" quedó archivada.`);
      setArchiveTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo archivar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dimensiones
        </h2>
        <button
          type="button"
          onClick={() => setNameDialog({ mode: "create" })}
          className="flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Dimensión
        </button>
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
              onRename={() => setNameDialog({ mode: "rename", dim: d })}
              onArchive={() => void openArchive(d)}
            />
          ))}
        </div>
      )}

      {/* Crear / renombrar */}
      <NameDialog
        state={nameDialog}
        onClose={() => setNameDialog(null)}
        onSubmit={async (name) => {
          if (!nameDialog) return;
          if (nameDialog.mode === "create") {
            await createDimension(area.id, name);
            toast.success(`Se creó la dimensión "${name.trim()}".`);
          } else {
            await renameDimension(nameDialog.dim.id, name);
            toast.success("Dimensión renombrada.");
          }
          await refresh();
          setNameDialog(null);
        }}
      />

      {/* Archivar (se pregunta en el momento si tiene elementos) */}
      <Dialog open={!!archiveTarget} onOpenChange={(v) => !v && !busy && setArchiveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archivar dimensión</DialogTitle>
            <DialogDescription>{archiveTarget?.dim.nombre}</DialogDescription>
          </DialogHeader>
          {!archiveTarget?.contents ? (
            <p className="text-sm text-muted-foreground">Revisando…</p>
          ) : archiveTarget.contents.total === 0 ? (
            <p className="text-sm text-foreground/85">
              No tiene elementos. Se archivará y dejará de aparecer en el Tablero.
            </p>
          ) : (
            <div className="space-y-2 text-sm text-foreground/85">
              <p>Esta dimensión contiene:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {archiveTarget.contents.projects > 0 && (
                  <li>{archiveTarget.contents.projects} proyecto(s)</li>
                )}
                {archiveTarget.contents.objectives > 0 && (
                  <li>{archiveTarget.contents.objectives} objetivo(s)</li>
                )}
                {archiveTarget.contents.habits > 0 && (
                  <li>{archiveTarget.contents.habits} hábito(s)</li>
                )}
                {archiveTarget.contents.tasks > 0 && (
                  <li>{archiveTarget.contents.tasks} tarea(s) directa(s)</li>
                )}
              </ul>
              <p>
                ¿Qué prefieres? Si la archivas, todos sus elementos pasan a{" "}
                <span className="font-medium">Sin dimensión</span> dentro de {area.nombre}. No se
                pierde nada.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={busy}>
              {archiveTarget?.contents && archiveTarget.contents.total > 0
                ? "Mantenerla"
                : "Cancelar"}
            </Button>
            <Button
              onClick={() => void confirmArchive()}
              disabled={busy || !archiveTarget?.contents}
            >
              {busy
                ? "Archivando…"
                : archiveTarget?.contents && archiveTarget.contents.total > 0
                  ? "Mover a Sin dimensión y archivar"
                  : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onRename,
  onArchive,
}: {
  area: AreaNode;
  dim: DimensionNode;
  proyecto?: string;
  subproyecto?: string;
  objetivo?: string;
  meta?: string;
  onRename: () => void;
  onArchive: () => void;
}) {
  const proyectos = area.proyectos.filter((p) => p.dimensionId === dim.id);
  const objetivos = area.objetivos.filter((o) => o.dimensionId === dim.id);
  const habitos = area.habitos.filter((h) => h.dimensionId === dim.id);
  const tareas = [...dim.tareas].sort(
    (a, b) => Number(!!a.completada || !!a.noHecha) - Number(!!b.completada || !!b.noHecha),
  );

  // Abierta por defecto si la URL apunta a algo que vive dentro.
  const containsUrlTarget =
    proyectos.some((p) => p.slug === proyecto) || objetivos.some((o) => o.slug === objetivo);
  const [open, setOpen] = useState(containsUrlTarget);
  const [newTask, setNewTask] = useState(false);

  const empty = proyectos.length + objetivos.length + habitos.length + tareas.length === 0;
  const resumen = [
    proyectos.length ? `${proyectos.length} proy.` : null,
    objetivos.length ? `${objetivos.length} obj.` : null,
    habitos.length ? `${habitos.length} háb.` : null,
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Opciones de ${dim.nombre}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>Renombrar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive}>Archivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

function NameDialog({
  state,
  onClose,
  onSubmit,
}: {
  state: { mode: "create" } | { mode: "rename"; dim: DimensionNode } | null;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Reinicia el campo cada vez que se abre.
  const key = state ? (state.mode === "create" ? "create" : `rename:${state.dim.id}`) : null;
  if (key !== lastKey) {
    setLastKey(key);
    setName(state && state.mode === "rename" ? state.dim.nombre : "");
  }

  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === "rename" ? "Renombrar dimensión" : "Nueva dimensión"}
          </DialogTitle>
          <DialogDescription>
            Una parte permanente de esta área, que no termina como un proyecto.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setSaving(true);
            try {
              await onSubmit(name);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-4"
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Ej: Administración"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {state?.mode === "rename" ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
