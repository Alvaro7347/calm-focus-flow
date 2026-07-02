/**
 * ========================================================
 * TaskDetailSheet
 *
 * Contenedor visual del formulario `TaskDetailForm`.
 *
 * UX:
 * - Desktop (≥ 768px): Drawer lateral derecho (Sheet side="right"),
 *   sin cambiar la URL ni perder el contexto de la pantalla.
 * - Mobile  (< 768px): Bottom Sheet (Sheet side="bottom"),
 *   con la misma funcionalidad.
 *
 * Un mismo componente sirve para crear y editar tareas. En modo
 * `edit` se pasa `taskId` y el sheet resuelve internamente
 * `TaskWithHierarchy` vía `taskService.fetchTaskForEdit()`.
 *
 * Este componente es el que abrirán FOCO, Calendar y Tablero en
 * iteraciones posteriores. Su contrato es intencionalmente simple:
 *   <TaskDetailSheet open onOpenChange={...} mode="edit" taskId={...} />
 * ========================================================
 */
import { useEffect, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchTaskForEdit, type TaskWithHierarchy } from "@/services/taskService";

import { TaskDetailForm, type TaskDetailMode } from "./TaskDetailForm";

export interface TaskDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TaskDetailMode;
  /** Requerido cuando mode = "edit". */
  taskId?: string;
}

export function TaskDetailSheet({
  open,
  onOpenChange,
  mode,
  taskId,
}: TaskDetailSheetProps) {
  const isMobile = useIsMobile();
  const [loadedTask, setLoadedTask] = useState<TaskWithHierarchy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar la tarea en modo edit cada vez que se abre con un id nuevo.
  useEffect(() => {
    if (!open || mode !== "edit" || !taskId) {
      setLoadedTask(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTaskForEdit(taskId)
      .then((res) => {
        if (cancelled) return;
        if (!res) setError("No se encontró la tarea.");
        else setLoadedTask(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar la tarea.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, taskId]);

  const side = isMobile ? "bottom" : "right";
  // Bottom sheet ~90vh en mobile; right drawer ~480px en desktop.
  const contentClass = isMobile
    ? "h-[90vh] w-full rounded-t-2xl p-0 flex flex-col sm:max-w-none"
    : "w-full sm:max-w-md md:max-w-lg p-0 flex flex-col";

  const title = mode === "edit" ? "Detalle de tarea" : "Nueva tarea";
  const description =
    mode === "edit"
      ? "Edita cualquier campo. Los cambios se guardan al pulsar Guardar."
      : "Añade una tarea a tu espacio. La organizarás con calma.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={contentClass}>
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {mode === "edit" && loading && (
            <p className="text-sm text-muted-foreground">Cargando tarea…</p>
          )}
          {mode === "edit" && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {(mode === "create" || (mode === "edit" && loadedTask && !loading)) && (
            <TaskDetailForm
              mode={mode}
              initialTask={loadedTask}
              onSaved={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
