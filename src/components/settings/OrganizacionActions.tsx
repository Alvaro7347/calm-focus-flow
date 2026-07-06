/**
 * OrganizacionActions
 * ---------------------------------------------------------------------------
 * Menú discreto de acciones (⋯) para cada nodo del árbol de Organización.
 *
 * Acciones implementadas:
 *  - Editar nombre (Dialog con input precargado y validación no-vacío).
 *  - Archivar (AlertDialog de confirmación, soft-delete vía `archived_at`).
 *
 * Fuera de alcance (preparado, no implementado):
 *  - Eliminar definitivamente / colores / compartir / reordenar.
 *
 * Invalidaciones:
 *  Al editar o archivar cualquier nodo se invalidan las queryKeys que
 *  alimentan las vistas activas: ["organizacion"] (este árbol),
 *  ["areas","nav"] (Sidebar/Drawer) y ["tablero"] (Tablero + FOCO/Calendar
 *  que arman su vista sobre el mismo árbol). Los tres servicios
 *  (area/project/subproject) filtran `archived_at IS NULL` por defecto,
 *  así que el elemento archivado desaparece de las vistas sin recargar.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Archive } from "lucide-react";
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

export type OrgNodeType = "area" | "project" | "subproject";

const LABELS: Record<OrgNodeType, { singular: string; article: string }> = {
  area: { singular: "área", article: "esta" },
  project: { singular: "proyecto", article: "este" },
  subproject: { singular: "subproyecto", article: "este" },
};

async function renameNode(type: OrgNodeType, id: string, name: string) {
  if (type === "area") return updateArea(id, { name });
  if (type === "project") return updateProject(id, { name });
  return updateSubproject(id, { name });
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
   * Slot opcional para elementos que quieran envolver el trigger
   * (por defecto es un botón ghost redondeado alineado a la fila).
   */
  triggerClassName?: string;
  children?: ReactNode;
}

export function OrganizacionActions({ id, type, name, triggerClassName }: Props) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState(name);

  // Editar o archivar un nodo organizacional puede cambiar qué tareas
  // se muestran en cada vista activa. Invalidamos:
  //  - ["organizacion"]: este propio árbol de Ajustes.
  //  - TASK_INVALIDATION_KEYS: ["focus"], ["calendar"], ["tablero"] y
  //    ["areas","nav"] (Sidebar/Drawer), que son las vistas que arman
  //    su contenido a partir de la jerarquía + tareas activas.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["organizacion"] });
    for (const key of TASK_INVALIDATION_KEYS) {
      qc.invalidateQueries({ queryKey: [...key] });
    }
  };

  const rename = useMutation({
    mutationFn: async (nextName: string) => renameNode(type, id, nextName),
    onSuccess: () => {
      invalidate();
      toast.success("Nombre actualizado");
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
      toast.success(`${LABELS[type].singular[0].toUpperCase()}${LABELS[type].singular.slice(1)} archivado`);
      setConfirmOpen(false);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "No se pudo archivar";
      toast.error(msg);
    },
  });

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== name && !rename.isPending;

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
              setDraft(name);
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" aria-hidden />
            Editar nombre
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
              Cambia el nombre. No afecta al historial de tareas.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) rename.mutate(trimmed);
            }}
            className="space-y-3"
          >
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={80}
              placeholder="Nombre"
              aria-label="Nombre"
            />
            {trimmed.length === 0 ? (
              <p className="text-xs text-rose-600">
                El nombre no puede estar vacío.
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
                disabled={rename.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSave}>
                {rename.isPending ? "Guardando…" : "Guardar"}
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
