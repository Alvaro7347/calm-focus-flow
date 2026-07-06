/**
 * ReuseStructureDialog
 *
 * Sugerencia discreta: cuando el usuario está creando un Área,
 * Proyecto o Subproyecto y la Memoria Inteligente detecta que
 * existe una estructura parecida creada antes, se ofrece
 * reutilizarla. El usuario mantiene control absoluto:
 *   [ Reutilizar ]  → duplica la estructura como árbol independiente.
 *   [ Crear desde cero ] → sigue el flujo normal, sin insistir.
 *
 * No modifica datos: la duplicación real la ejecuta
 * `memorySuggestionService.duplicateStructure`.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StructureMatch } from "@/services/memorySuggestionService";

interface ReuseStructureDialogProps {
  open: boolean;
  match: StructureMatch | null;
  newName: string;
  busy?: boolean;
  onReuse: () => void;
  onCreateFromScratch: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "sin actividad reciente";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function kindLabel(kind: StructureMatch["kind"]): string {
  switch (kind) {
    case "area":
      return "área";
    case "project":
      return "proyecto";
    case "subproject":
      return "subproyecto";
    default:
      return "estructura";
  }
}

export function ReuseStructureDialog({
  open,
  match,
  newName,
  busy,
  onReuse,
  onCreateFromScratch,
}: ReuseStructureDialogProps) {
  if (!match) return null;
  const label = kindLabel(match.kind);
  const { summary } = match;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCreateFromScratch();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estructura similar encontrada</DialogTitle>
          <DialogDescription>
            Hemos encontrado un {label} que ya usaste antes con una estructura
            parecida. ¿Quieres reutilizarla para “{newName}”?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
          <p className="font-medium">{match.sourceName}</p>
          {match.sourceAreaName && match.kind !== "area" && (
            <p className="text-muted-foreground text-xs">
              Área: {match.sourceAreaName}
              {match.sourceProjectName ? ` · Proyecto: ${match.sourceProjectName}` : ""}
            </p>
          )}
          <ul className="text-muted-foreground text-xs mt-2 space-y-0.5">
            {match.kind === "area" && (
              <li>{summary.projectsCount} proyectos</li>
            )}
            {match.kind !== "subproject" && (
              <li>{summary.subprojectsCount} subproyectos</li>
            )}
            <li>{summary.tasksCount} tareas</li>
            <li>Última actividad: {formatDate(summary.lastUsedAt)}</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          La nueva versión será completamente independiente. La original no se modifica.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCreateFromScratch}
            disabled={busy}
          >
            Crear desde cero
          </Button>
          <Button type="button" onClick={onReuse} disabled={busy}>
            {busy ? "Reutilizando..." : "Reutilizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
