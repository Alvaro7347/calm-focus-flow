/**
 * ========================================================
 * TaskDetailSheet
 *
 * Contenedor visual del formulario `TaskDetailForm`.
 *
 * Modos:
 * - "create":    formulario vacío.
 * - "edit":      carga la tarea/evento por `taskId` y actualiza.
 * - "duplicate": carga la tarea/evento por `taskId` y usa sus
 *                datos como valores iniciales para crear una copia
 *                independiente (llama a `createTask`, nunca a
 *                `updateTask`). Cancelar no crea nada.
 *
 * El paso edit → duplicate se maneja internamente: el usuario
 * pulsa "Duplicar" dentro del formulario en modo edit y este
 * componente cambia su modo interno sin cerrar el sheet.
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
  /** Requerido cuando mode = "edit" o "duplicate". */
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

  // Modo interno: permite cambiar de "edit" a "duplicate" sin cerrar
  // el sheet ni perder los datos ya cargados.
  const [effectiveMode, setEffectiveMode] = useState<TaskDetailMode>(mode);
  useEffect(() => {
    setEffectiveMode(mode);
  }, [mode, open, taskId]);

  const needsLoad = effectiveMode === "edit" || effectiveMode === "duplicate";

  // Cargar la tarea siempre que el modo requiera datos previos.
  useEffect(() => {
    if (!open || !needsLoad || !taskId) {
      if (!open) {
        setLoadedTask(null);
        setError(null);
      }
      return;
    }
    // Si ya tenemos la tarea correcta cargada (p. ej. tras cambiar de
    // edit → duplicate), no volvemos a pedirla.
    if (loadedTask && loadedTask.task.id === taskId) return;
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
  }, [open, needsLoad, taskId, loadedTask]);

  const side = isMobile ? "bottom" : "right";
  const contentClass = isMobile
    ? "h-[90vh] w-full rounded-t-2xl p-0 flex flex-col sm:max-w-none"
    : "w-full sm:max-w-md md:max-w-lg p-0 flex flex-col";

  const isEvento = loadedTask?.task.activity_type === "event";
  const title =
    effectiveMode === "duplicate"
      ? isEvento
        ? "Duplicar evento"
        : "Duplicar tarea"
      : effectiveMode === "edit"
        ? "Detalle de tarea"
        : "Nueva tarea";
  const description =
    effectiveMode === "duplicate"
      ? "Estás creando una copia independiente. La original no se modifica."
      : effectiveMode === "edit"
        ? "Edita cualquier campo. Los cambios se guardan al pulsar Guardar."
        : "Añade una tarea a tu espacio. La organizarás con calma.";

  const showForm =
    effectiveMode === "create" || (needsLoad && loadedTask && !loading);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={contentClass}>
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {needsLoad && loading && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
          {needsLoad && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {showForm && (
            <TaskDetailForm
              mode={effectiveMode}
              initialTask={loadedTask}
              onSaved={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
              onRequestDuplicate={
                effectiveMode === "edit"
                  ? () => setEffectiveMode("duplicate")
                  : undefined
              }
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
