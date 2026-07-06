/**
 * OrganizacionActions
 * ---------------------------------------------------------------------------
 * Menú discreto de acciones (⋯) para cada nodo del árbol de Organización.
 *
 * Acciones implementadas:
 *  - Editar nombre (Dialog con input precargado y validación no-vacío).
 *  - Editar color (SOLO Proyectos, paleta CalmApp de 12 colores).
 *  - Archivar (AlertDialog de confirmación, soft-delete vía `archived_at`).
 *
 * Identidad visual de Proyectos:
 *  - Sólo los Proyectos tienen color (paleta cerrada, `projectIdentity.ts`).
 *  - El picker sólo se muestra cuando `type === "project"`.
 *  - La arquitectura queda preparada para agregar en el futuro icono,
 *    emoji o imagen: se sumarán nuevas secciones al Dialog y nuevos
 *    campos al `updateProject` sin cambiar los consumidores actuales.
 *
 * Invalidaciones:
 *  Al editar o archivar cualquier nodo se invalidan las queryKeys que
 *  alimentan las vistas activas: ["organizacion"] (este árbol) y
 *  TASK_INVALIDATION_KEYS (["focus"], ["calendar"], ["tablero"],
 *  ["areas","nav"]). Los servicios filtran `archived_at IS NULL` en
 *  cadena, así que el elemento archivado desaparece sin recargar.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Archive, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateArea, archiveArea } from "@/services/areaService";
import { updateProject, archiveProject } from "@/services/projectService";
import {
  updateSubproject,
  archiveSubproject,
} from "@/services/subprojectService";
import { TASK_INVALIDATION_KEYS } from "@/services/taskService";
import {
  PROJECT_COLORS,
  DEFAULT_PROJECT_COLOR,
  type ProjectColorSlug,
} from "@/lib/projectIdentity";

export type OrgNodeType = "area" | "project" | "subproject";

const LABELS: Record<OrgNodeType, { singular: string; article: string }> = {
  area: { singular: "área", article: "esta" },
  project: { singular: "proyecto", article: "este" },
  subproject: { singular: "subproyecto", article: "este" },
};

interface RenamePatch {
  name?: string;
  color?: ProjectColorSlug;
}

async function updateNode(type: OrgNodeType, id: string, patch: RenamePatch) {
  if (type === "area") return updateArea(id, { name: patch.name });
  if (type === "project")
    return updateProject(id, { name: patch.name, color: patch.color });
  return updateSubproject(id, { name: patch.name });
}

async function archiveNode(type: OrgNodeType, id: string) {
  if (type === "area") return archiveArea(id);
  if (type === "project") return archiveProject(id);
  return archiveSubproject(id);
}

interface Props {
  id: string;
  type: OrgNodeType;
  name: string;
  /**
   * Sólo para proyectos: slug de color actual (paleta CalmApp).
   * Los otros tipos lo ignoran.
   */
  color?: string | null;
  triggerClassName?: string;
  children?: ReactNode;
}

export function OrganizacionActions({
  id,
  type,
  name,
  color,
  triggerClassName,
}: Props) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const initialColor = (color as ProjectColorSlug | null | undefined) ?? DEFAULT_PROJECT_COLOR;
  const [colorDraft, setColorDraft] = useState<ProjectColorSlug>(initialColor);

  // Resetear los borradores cada vez que se abre el diálogo, para que
  // reflejen el estado actual del nodo (por si otra pestaña lo cambió).
  useEffect(() => {
    if (editOpen) {
      setDraft(name);
      setColorDraft(initialColor);
    }
  }, [editOpen, name, initialColor]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["organizacion"] });
    for (const key of TASK_INVALIDATION_KEYS) {
      qc.invalidateQueries({ queryKey: [...key] });
    }
  };

  const save = useMutation({
    mutationFn: async (patch: RenamePatch) => updateNode(type, id, patch),
    onSuccess: () => {
      invalidate();
      toast.success("Cambios guardados");
      setEditOpen(false);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "No se pudo actualizar";
      toast.error(msg);
    },
  });

  const archive = useMutation({
    mutationFn: async () => archiveNode(type, id),
    onSuccess: () => {
      invalidate();
      toast.success(
        `${LABELS[type].singular[0].toUpperCase()}${LABELS[type].singular.slice(1)} archivado`,
      );
      setConfirmOpen(false);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "No se pudo archivar";
      toast.error(msg);
    },
  });

  const trimmed = draft.trim();
  const nameChanged = trimmed.length > 0 && trimmed !== name;
  const colorChanged = type === "project" && colorDraft !== initialColor;
  const canSave = (nameChanged || colorChanged) && trimmed.length > 0 && !save.isPending;

  function handleSubmit() {
    if (!canSave) return;
    const patch: RenamePatch = {};
    if (nameChanged) patch.name = trimmed;
    if (colorChanged) patch.color = colorDraft;
    save.mutate(patch);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label="Acciones"
            className={
              triggerClassName ??
              "shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            }
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" aria-hidden />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            className="text-rose-600 focus:text-rose-700"
          >
            <Archive className="h-4 w-4 mr-2" aria-hidden />
            Archivar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Editar {LABELS[type].singular}</DialogTitle>
            <DialogDescription>
              {type === "project"
                ? "Cambia el nombre o el color. No afecta al historial de tareas."
                : "Cambia el nombre. No afecta al historial de tareas."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600" htmlFor="org-name">
                Nombre
              </label>
              <Input
                id="org-name"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={80}
                placeholder="Nombre"
              />
              {trimmed.length === 0 ? (
                <p className="text-xs text-rose-600">
                  El nombre no puede estar vacío.
                </p>
              ) : null}
            </div>

            {type === "project" ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Color del proyecto</p>
                <p className="text-xs text-slate-400">
                  Ayuda a reconocer el proyecto en Tablero, Calendario y FOCO.
                </p>
                <div
                  role="radiogroup"
                  aria-label="Color del proyecto"
                  className="flex flex-wrap gap-2 pt-1"
                >
                  {PROJECT_COLORS.map((c) => {
                    const selected = colorDraft === c.slug;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={c.label}
                        title={c.label}
                        onClick={() => setColorDraft(c.slug)}
                        className={`relative h-8 w-8 rounded-full ${c.dot} transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${c.ring} ${
                          selected ? "ring-2 ring-offset-2 " + c.ring : ""
                        }`}
                      >
                        {selected ? (
                          <Check
                            className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
                disabled={save.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSave}>
                {save.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Archivar {LABELS[type].article} {LABELS[type].singular}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se ocultará de las vistas activas, pero no se eliminará su historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archive.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                archive.mutate();
              }}
              disabled={archive.isPending}
              className="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-400"
            >
              {archive.isPending ? "Archivando…" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
