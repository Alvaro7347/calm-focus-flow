/**
 * EtiquetasManager — Ajustes → Etiquetas.
 *
 * Lista las etiquetas del usuario con cuántas actividades las usan,
 * y permite crear, renombrar y archivar. Archivar no borra: la
 * etiqueta deja de ofrecerse, pero sus asignaciones se conservan.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Pencil, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  archiveTag,
  createTag,
  fetchTagUsage,
  fetchTags,
  renameTag,
  type TagRow,
} from "@/services/tagService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";

export function EtiquetasManager() {
  const qc = useQueryClient();
  const { data: tags = [], isLoading } = useQuery({ queryKey: ["tags"], queryFn: fetchTags });
  const { data: usage = {} } = useQuery({ queryKey: ["tags", "usage"], queryFn: fetchTagUsage });
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<TagRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [archiving, setArchiving] = useState<TagRow | null>(null);

  async function refresh() {
    await invalidateActivityGraph(qc);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createTag(newName);
      setNewName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la etiqueta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!renaming) return;
    setBusy(true);
    try {
      await renameTag(renaming.id, renameValue);
      setRenaming(null);
      await refresh();
      toast.success("Etiqueta renombrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo renombrar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!archiving) return;
    setBusy(true);
    try {
      await archiveTag(archiving.id);
      setArchiving(null);
      await refresh();
      toast.success("Etiqueta archivada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo archivar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
        className="flex gap-2"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          placeholder="Nueva etiqueta (ej: Instagram)"
        />
        <Button type="submit" disabled={!newName.trim() || busy}>
          Crear
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no tienes etiquetas. También puedes crearlas al editar una tarea.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {tags.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2">
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {usage[t.id] ?? 0} {(usage[t.id] ?? 0) === 1 ? "actividad" : "actividades"}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Renombrar ${t.name}`}
                onClick={() => {
                  setRenaming(t);
                  setRenameValue(t.name);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Archivar ${t.name}`}
                onClick={() => setArchiving(t)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!renaming} onOpenChange={(v) => !v && !busy && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renombrar etiqueta</DialogTitle>
            <DialogDescription>
              El cambio se aplica a todas las actividades que la usan.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={40}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRenaming(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRename()} disabled={!renameValue.trim() || busy}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archiving} onOpenChange={(v) => !v && !busy && setArchiving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archivar etiqueta</DialogTitle>
            <DialogDescription>{archiving?.name}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-foreground/85">
            Dejará de ofrecerse al etiquetar. Las actividades que ya la tienen la conservan como
            historial. No se borra nada.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setArchiving(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void handleArchive()} disabled={busy}>
              Archivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
