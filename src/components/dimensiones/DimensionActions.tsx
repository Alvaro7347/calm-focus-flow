/**
 * ========================================================
 * DimensionActions — acciones de Dimensión compartidas
 *
 * Usado por el Tablero (DimensionesSection) y por
 * Ajustes → Organización (OrganizacionTree), para que ambos
 * se comporten exactamente igual:
 *
 *  - <NewDimensionButton areaId>: "+ Dimensión" con su diálogo.
 *  - <DimensionMenu dimension areaName>: menú ⋯ con
 *      Renombrar · Archivar (si tiene elementos, pregunta en el
 *      momento: mantenerla o moverlos a "Sin dimensión").
 * ========================================================
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
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
import { invalidateActivityGraph } from "@/lib/queryInvalidation";
import {
  archiveDimensionMovingContents,
  countDimensionContents,
  createDimension,
  renameDimension,
  type DimensionContents,
} from "@/services/dimensionService";

// ------------------------------------------------------------
// Crear
// ------------------------------------------------------------

export function NewDimensionButton({ areaId, className }: { areaId: string; className?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
        }
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Dimensión
      </button>
      <DimensionNameDialog
        open={open}
        title="Nueva dimensión"
        initialName=""
        submitLabel="Crear"
        onClose={() => setOpen(false)}
        onSubmit={async (name) => {
          await createDimension(areaId, name);
          await invalidateActivityGraph(qc);
          toast.success(`Se creó la dimensión "${name.trim()}".`);
          setOpen(false);
        }}
      />
    </>
  );
}

// ------------------------------------------------------------
// Menú ⋯ (Renombrar · Archivar)
// ------------------------------------------------------------

export function DimensionMenu({
  dimension,
  areaName,
  triggerClassName,
}: {
  dimension: { id: string; nombre: string };
  areaName: string;
  triggerClassName?: string;
}) {
  const qc = useQueryClient();
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [contents, setContents] = useState<DimensionContents | null>(null);
  const [busy, setBusy] = useState(false);

  async function openArchive() {
    setContents(null);
    setArchiveOpen(true);
    try {
      setContents(await countDimensionContents(dimension.id));
    } catch {
      toast.error("No se pudo revisar el contenido de la dimensión.");
      setArchiveOpen(false);
    }
  }

  async function confirmArchive() {
    setBusy(true);
    try {
      await archiveDimensionMovingContents(dimension.id);
      await invalidateActivityGraph(qc);
      toast.success(`"${dimension.nombre}" quedó archivada.`);
      setArchiveOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo archivar.");
    } finally {
      setBusy(false);
    }
  }

  const hasContents = !!contents && contents.total > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Opciones de ${dimension.nombre}`}
            className={
              triggerClassName ??
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>Renombrar</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void openArchive()}
            className="text-rose-600 focus:text-rose-700"
          >
            Archivar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DimensionNameDialog
        open={renameOpen}
        title="Renombrar dimensión"
        initialName={dimension.nombre}
        submitLabel="Guardar"
        onClose={() => setRenameOpen(false)}
        onSubmit={async (name) => {
          await renameDimension(dimension.id, name);
          await invalidateActivityGraph(qc);
          toast.success("Dimensión renombrada.");
          setRenameOpen(false);
        }}
      />

      <Dialog open={archiveOpen} onOpenChange={(v) => !v && !busy && setArchiveOpen(false)}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Archivar dimensión</DialogTitle>
            <DialogDescription>{dimension.nombre}</DialogDescription>
          </DialogHeader>
          {!contents ? (
            <p className="text-sm text-muted-foreground">Revisando…</p>
          ) : !hasContents ? (
            <p className="text-sm text-foreground/85">
              No tiene elementos. Se archivará y dejará de aparecer.
            </p>
          ) : (
            <div className="space-y-2 text-sm text-foreground/85">
              <p>Esta dimensión contiene:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {contents.projects > 0 && <li>{contents.projects} proyecto(s)</li>}
                {contents.objectives > 0 && <li>{contents.objectives} objetivo(s)</li>}
                {contents.habits > 0 && <li>{contents.habits} hábito(s)</li>}
                {contents.tasks > 0 && <li>{contents.tasks} tarea(s) directa(s)</li>}
              </ul>
              <p>
                ¿Qué prefieres? Si la archivas, todos sus elementos pasan a{" "}
                <span className="font-medium">Sin dimensión</span> dentro de {areaName}. No se
                pierde nada.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={busy}>
              {hasContents ? "Mantenerla" : "Cancelar"}
            </Button>
            <Button onClick={() => void confirmArchive()} disabled={busy || !contents}>
              {busy ? "Archivando…" : hasContents ? "Mover a Sin dimensión y archivar" : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ------------------------------------------------------------
// Diálogo de nombre (crear / renombrar)
// ------------------------------------------------------------

function DimensionNameDialog({
  open,
  title,
  initialName,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialName: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Reinicia el campo cada vez que se abre.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(initialName);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Una parte permanente del área, que no termina como un proyecto.
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
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
