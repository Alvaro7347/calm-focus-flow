/**
 * ========================================================
 * TaskDetailForm
 *
 * Formulario ÚNICO de tareas de CalmApp. Se usa tanto para
 * crear como para editar. No debe existir un segundo sistema
 * de formularios.
 *
 * Modos:
 * - "create": el formulario nace vacío. Al guardar, inserta.
 * - "edit":   recibe `initialTask` (`TaskWithHierarchy`) y al
 *             guardar actualiza. Nunca crea.
 *
 * Reglas:
 * - Sólo consume la capa de servicios (`taskService`,
 *   `areaService`, `projectService`, `subprojectService`).
 *   No accede a Supabase directamente.
 * - Al guardar (create o edit) invalida TASK_INVALIDATION_KEYS
 *   para propagar los cambios a FOCO, Calendar, Tablero y
 *   Sidebar sin refrescar la aplicación.
 * - Archivar es una acción del modo edit. Nunca elimina
 *   físicamente: escribe `archived_at`.
 *
 * Extensibilidad futura (NO implementar aún):
 * - Adjuntos, comentarios, historial, IA, Google Calendar,
 *   recordatorios, etiquetas y relaciones se sumarán como
 *   secciones adicionales tras "Programación", con su propio
 *   subcomponente. El contrato de este archivo no cambiará.
 * ========================================================
 */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { fetchAreas, createArea } from "@/services/areaService";
import { fetchProjects, createProject } from "@/services/projectService";
import { fetchSubprojects, createSubproject } from "@/services/subprojectService";
import {
  archiveTask,
  createTask,
  updateTask,
  TASK_INVALIDATION_KEYS,
  type CreateTaskInput,
  type TaskPriority,
  type TaskRow,
  type TaskStatus,
  type TaskWithHierarchy,
} from "@/services/taskService";
import type { AreaRow, ProjectRow, SubprojectRow } from "@/types/tarea";
import { getProjectColor } from "@/lib/projectIdentity";

export type TaskDetailMode = "create" | "edit";

export interface TaskDetailFormProps {
  mode: TaskDetailMode;
  /** Requerido en modo `edit`. Ignorado en modo `create`. */
  initialTask?: TaskWithHierarchy | null;
  /** Se llama tras guardar o archivar con éxito. Útil para cerrar el sheet. */
  onSaved?: (task: TaskRow) => void;
  /** Se llama cuando el usuario cancela. */
  onCancel?: () => void;
}

type InlineKind = "area" | "project" | "subproject" | null;

/** Convierte una fecha ISO (UTC) al par local (YYYY-MM-DD, HH:mm) para inputs. */
function splitIsoToLocalDateTime(iso: string | null): { fecha: string; hora: string } {
  if (!iso) return { fecha: "", hora: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { fecha: "", hora: "" };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  // Convención: 00:00 local se interpreta como "todo el día" (sin hora).
  const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;
  return {
    fecha: `${y}-${m}-${day}`,
    hora: isMidnight ? "" : `${hh}:${mm}`,
  };
}

export function TaskDetailForm({
  mode,
  initialTask,
  onSaved,
  onCancel,
}: TaskDetailFormProps) {
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";

  // ---------- Estado del formulario ----------
  const initialSplit = splitIsoToLocalDateTime(initialTask?.task.starts_at ?? null);

  const [title, setTitle] = useState(initialTask?.task.title ?? "");
  const [description, setDescription] = useState(initialTask?.task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(
    (initialTask?.task.priority as TaskPriority | undefined) ?? "medium",
  );
  const [status, setStatus] = useState<TaskStatus>(
    (initialTask?.task.status as TaskStatus | undefined) ?? "pending",
  );
  const [fecha, setFecha] = useState(initialSplit.fecha);
  const [hora, setHora] = useState(initialSplit.hora);
  const [duracion, setDuracion] = useState<string>(
    initialTask?.task.estimated_duration_min != null
      ? String(initialTask.task.estimated_duration_min)
      : "",
  );

  // ---------- Jerarquía ----------
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [subprojects, setSubprojects] = useState<SubprojectRow[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areaId, setAreaId] = useState<string>(initialTask?.areaId ?? "");
  const [projectId, setProjectId] = useState<string>(initialTask?.projectId ?? "");
  const [subprojectId, setSubprojectId] = useState<string>(initialTask?.subprojectId ?? "");

  // Cuando cambia el área o el proyecto por acción del usuario, reseteamos
  // los niveles inferiores. Este flag evita el reset durante la primera
  // carga en modo edit (donde areaId/projectId ya vienen precargados).
  const [userTouchedArea, setUserTouchedArea] = useState(false);
  const [userTouchedProject, setUserTouchedProject] = useState(false);

  // ---------- Guardar / errores ----------
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---------- Creación inline ----------
  const [inlineOpen, setInlineOpen] = useState<InlineKind>(null);
  const [inlineName, setInlineName] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // ---- Áreas: carga inicial
  useEffect(() => {
    let cancelled = false;
    setAreasLoading(true);
    fetchAreas()
      .then((rows) => {
        if (!cancelled) {
          setAreas(rows);
          setAreasLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAreas([]);
          setAreasLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Área → Proyectos
  useEffect(() => {
    if (!areaId) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    fetchProjects(areaId)
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  // ---- Proyecto → Subproyectos
  useEffect(() => {
    if (!projectId) {
      setSubprojects([]);
      return;
    }
    let cancelled = false;
    fetchSubprojects(projectId)
      .then((rows) => {
        if (!cancelled) setSubprojects(rows);
      })
      .catch(() => {
        if (!cancelled) setSubprojects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function handleAreaChange(value: string) {
    setAreaId(value);
    if (userTouchedArea || value !== initialTask?.areaId) {
      setProjectId("");
      setSubprojectId("");
    }
    setUserTouchedArea(true);
  }

  function handleProjectChange(value: string) {
    setProjectId(value);
    if (userTouchedProject || value !== initialTask?.projectId) {
      setSubprojectId("");
    }
    setUserTouchedProject(true);
  }

  function openInline(kind: Exclude<InlineKind, null>) {
    setInlineName("");
    setInlineError(null);
    setInlineOpen(kind);
  }

  async function handleInlineCreate() {
    const name = inlineName.trim();
    if (!name) {
      setInlineError("El nombre es obligatorio.");
      return;
    }
    setInlineSaving(true);
    setInlineError(null);
    try {
      if (inlineOpen === "area") {
        const created = await createArea({ name });
        const rows = await fetchAreas();
        setAreas(rows);
        setAreaId(created.id);
        setProjectId("");
        setSubprojectId("");
      } else if (inlineOpen === "project") {
        if (!areaId) throw new Error("Selecciona un área primero.");
        const created = await createProject({ name, area_id: areaId });
        const rows = await fetchProjects(areaId);
        setProjects(rows);
        setProjectId(created.id);
        setSubprojectId("");
      } else if (inlineOpen === "subproject") {
        if (!projectId) throw new Error("Selecciona un proyecto primero.");
        const created = await createSubproject({ name, project_id: projectId });
        const rows = await fetchSubprojects(projectId);
        setSubprojects(rows);
        setSubprojectId(created.id);
      }
      setInlineOpen(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear.";
      setInlineError(msg);
    } finally {
      setInlineSaving(false);
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!areaId) next.area = "Selecciona un área.";
    if (!projectId) next.project = "Selecciona un proyecto.";
    if (!subprojectId) next.subproject = "Selecciona un subproyecto.";
    if (!title.trim()) next.title = "Escribe un título.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildStartsAt(): string | null {
    if (!fecha) return null;
    const iso = hora ? `${fecha}T${hora}:00` : `${fecha}T00:00:00`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function invalidateAll() {
    await Promise.all(
      TASK_INVALIDATION_KEYS.map((key) =>
        queryClient.invalidateQueries({ queryKey: key as unknown as string[] }),
      ),
    );
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const startsAt = buildStartsAt();
      const duracionNum = duracion ? Number(duracion) : null;

      let saved: TaskRow;
      if (isEdit) {
        if (!initialTask) throw new Error("Falta la tarea a editar.");
        // completed_at debe mantenerse coherente con el estado.
        const nextCompletedAt =
          status === "completed"
            ? (initialTask.task.completed_at ?? new Date().toISOString())
            : null;
        saved = await updateTask(initialTask.task.id, {
          subproject_id: subprojectId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status,
          starts_at: startsAt,
          estimated_duration_min: duracionNum,
          completed_at: nextCompletedAt,
        });
        toast.success("Tarea actualizada.");
      } else {
        const input: CreateTaskInput = {
          subproject_id: subprojectId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status,
          source: "manual",
          starts_at: startsAt,
          estimated_duration_min: duracionNum,
        };
        saved = await createTask(input);
        toast.success("Tarea creada.");
      }
      await invalidateAll();
      onSaved?.(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar la tarea.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!initialTask) return;
    setArchiving(true);
    try {
      const saved = await archiveTask(initialTask.task.id);
      await invalidateAll();
      toast.success("Tarea archivada.");
      onSaved?.(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo archivar.";
      toast.error(msg);
    } finally {
      setArchiving(false);
      setConfirmArchive(false);
    }
  }

  const projectDisabled = !areaId || projects.length === 0;
  const subprojectDisabled = !projectId || subprojects.length === 0;

  const areaPlaceholder = useMemo(() => {
    if (areasLoading) return "Cargando…";
    return areas.length === 0 ? "Aún no tienes áreas" : "Selecciona un área";
  }, [areas.length, areasLoading]);

  return (
    <div className="flex h-full flex-col">
      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        <div className="space-y-6">
          {/* 1. Información */}
          <section className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="td-title">Título *</Label>
              <Input
                id="td-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombra tu tarea"
                autoFocus={!isEdit}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="td-description">Descripción</Label>
              <Textarea
                id="td-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles opcionales"
                className="min-h-24 resize-none"
              />
            </div>
          </section>

          {/* 2. Organización */}
          <section className="rounded-xl border bg-card p-4 space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">Organización</h2>

            {/* Área */}
            <div className="space-y-2">
              <Label>Área *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={areaId}
                    onValueChange={handleAreaChange}
                    disabled={areasLoading || areas.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={areaPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden
                              className={`h-2 w-2 rounded-full shrink-0 ${getProjectColor(a.color).dot}`}
                            />
                            {a.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => openInline("area")}
                  aria-label="Nueva área"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.area && <p className="text-xs text-destructive">{errors.area}</p>}
            </div>

            {/* Proyecto */}
            <div className="space-y-2">
              <Label>Proyecto *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={projectId}
                    onValueChange={handleProjectChange}
                    disabled={projectDisabled}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !areaId
                            ? "Primero elige un área"
                            : projects.length === 0
                              ? "Aún no hay proyectos"
                              : "Selecciona un proyecto"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => openInline("project")}
                  disabled={!areaId}
                  aria-label="Nuevo proyecto"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.project && <p className="text-xs text-destructive">{errors.project}</p>}
            </div>

            {/* Subproyecto */}
            <div className="space-y-2">
              <Label>Subproyecto *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={subprojectId}
                    onValueChange={setSubprojectId}
                    disabled={subprojectDisabled}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !projectId
                            ? "Primero elige un proyecto"
                            : subprojects.length === 0
                              ? "Aún no hay subproyectos"
                              : "Selecciona un subproyecto"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {subprojects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => openInline("subproject")}
                  disabled={!projectId}
                  aria-label="Nuevo subproyecto"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.subproject && (
                <p className="text-xs text-destructive">{errors.subproject}</p>
              )}
            </div>
          </section>

          {/* 3. Estado + Prioridad */}
          <section className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="waiting">Esperando</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* 4. Programación */}
          <section className="rounded-xl border bg-card p-4 space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">Programación</h2>
            <p className="text-xs text-muted-foreground">
              Sin fecha, la tarea no aparecerá en el Calendario.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="td-fecha">Fecha</Label>
                <Input
                  id="td-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="td-hora">Hora</Label>
                <Input
                  id="td-hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="td-duracion">Duración estimada (min)</Label>
              <Input
                id="td-duracion"
                type="number"
                min={0}
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
                placeholder="Ej: 30"
              />
            </div>
          </section>

          {/* Placeholder de secciones futuras — NO implementar aún.
              Adjuntos · Comentarios · Historial · IA · Google Calendar ·
              Recordatorios · Etiquetas · Relaciones. Se sumarán como
              secciones adicionales sin cambiar el contrato del formulario. */}
        </div>
      </div>

      {/* Barra inferior de acciones */}
      <div className="mt-4 flex flex-col gap-2 border-t bg-background pt-4">
        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={saving || archiving}
            >
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            className="flex-1"
            onClick={handleSave}
            disabled={saving || archiving}
          >
            {saving
              ? "Guardando..."
              : isEdit
                ? "Guardar cambios"
                : "Guardar tarea"}
          </Button>
        </div>
        {isEdit && initialTask && !initialTask.task.archived_at && (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmArchive(true)}
            disabled={saving || archiving}
          >
            <Archive className="h-4 w-4" /> Archivar tarea
          </Button>
        )}
      </div>

      {/* Dialog: creación inline de Área / Proyecto / Subproyecto */}
      <Dialog
        open={inlineOpen !== null}
        onOpenChange={(open) => {
          if (!open) setInlineOpen(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {inlineOpen === "area" && "Nueva área"}
              {inlineOpen === "project" && "Nuevo proyecto"}
              {inlineOpen === "subproject" && "Nuevo subproyecto"}
            </DialogTitle>
            <DialogDescription>
              {inlineOpen === "area" && "Crea un área para organizar tus tareas."}
              {inlineOpen === "project" &&
                "El proyecto se creará dentro del área seleccionada."}
              {inlineOpen === "subproject" &&
                "El subproyecto se creará dentro del proyecto seleccionado."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="inline-name">Nombre *</Label>
            <Input
              id="inline-name"
              value={inlineName}
              onChange={(e) => setInlineName(e.target.value)}
              placeholder="Ej: Marketing"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleInlineCreate();
                }
              }}
            />
            {inlineError && <p className="text-xs text-destructive">{inlineError}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInlineOpen(null)}
              disabled={inlineSaving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleInlineCreate} disabled={inlineSaving}>
              {inlineSaving ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de archivado */}
      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              La tarea dejará de aparecer en FOCO, Calendar y Tablero. No se
              elimina: siempre podrás recuperarla desde el archivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiving}>
              {archiving ? "Archivando..." : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
