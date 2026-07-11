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
  findSimilarStructure,
  duplicateStructure,
  type StructureMatch,
} from "@/services/memorySuggestionService";
import { ReuseStructureDialog } from "@/components/memory/ReuseStructureDialog";
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
import type { ActivityType } from "@/types/activity";
import { ACTIVITY_TYPE_DB } from "@/types/activity";
import { getProjectColor } from "@/lib/projectIdentity";
import {
  findEventConflict,
  parseEventConflictError,
  buildConflictMessage,
  type EventConflict,
} from "@/services/eventConflictService";

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
  const initialEndSplit = splitIsoToLocalDateTime(initialTask?.task.ends_at ?? null);
  const initialActivityType: ActivityType =
    initialTask?.task.activity_type === "event" ? "evento" : "tarea";

  const [activityType, setActivityType] = useState<ActivityType>(initialActivityType);
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
  const [horaFin, setHoraFin] = useState(initialEndSplit.hora);
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

  // ---------- Sugerencia de reutilización (Memoria Inteligente) ----------
  // `rejectedSuggestions` guarda claves de sugerencias ya rechazadas en esta
  // sesión de creación para no volver a insistir con el mismo nombre y scope.
  const [suggestion, setSuggestion] = useState<StructureMatch | null>(null);
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(
    () => new Set(),
  );

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

  /**
   * Ejecuta la creación "en crudo" (sin sugerencia) del elemento inline
   * y refresca la jerarquía relevante. Es la única ruta que INSERTA
   * un Área/Proyecto/Subproyecto desde este formulario.
   */
  async function performInlineCreate(name: string): Promise<void> {
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
  }

  /** Clave estable para no re-sugerir la misma coincidencia si el usuario la rechazó. */
  function suggestionKey(kind: InlineKind, name: string): string {
    const scope =
      kind === "project" ? areaId : kind === "subproject" ? projectId : "-";
    return `${kind}::${name.toLowerCase().trim()}::${scope}`;
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
      // Validaciones previas de scope antes de consultar la memoria.
      if (inlineOpen === "project" && !areaId) {
        throw new Error("Selecciona un área primero.");
      }
      if (inlineOpen === "subproject" && !projectId) {
        throw new Error("Selecciona un proyecto primero.");
      }

      // Consulta a la Memoria Inteligente. Nunca modifica datos: sólo sugiere.
      const key = suggestionKey(inlineOpen, name);
      if (inlineOpen && !rejectedSuggestions.has(key)) {
        const match = await findSimilarStructure(inlineOpen, name, {
          areaId: areaId || undefined,
          projectId: projectId || undefined,
        });
        if (match) {
          setSuggestion(match);
          setInlineSaving(false);
          return; // La UI decide: Reutilizar o Crear desde cero.
        }
      }

      await performInlineCreate(name);
      setInlineOpen(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear.";
      setInlineError(msg);
    } finally {
      setInlineSaving(false);
    }
  }

  /** Confirmación del usuario: duplicar la estructura sugerida. */
  async function handleReuseSuggestion() {
    if (!suggestion || !inlineOpen) return;
    setSuggestionBusy(true);
    setInlineError(null);
    try {
      const result = await duplicateStructure(suggestion, inlineName.trim(), {
        areaId: areaId || undefined,
        projectId: projectId || undefined,
      });
      // Refrescar la jerarquía dependiente y seleccionar el nuevo nodo.
      if (result.kind === "area") {
        const rows = await fetchAreas();
        setAreas(rows);
        setAreaId(result.newId);
        setProjectId("");
        setSubprojectId("");
      } else if (result.kind === "project") {
        const rows = await fetchProjects(areaId);
        setProjects(rows);
        setProjectId(result.newId);
        setSubprojectId("");
      } else {
        const rows = await fetchSubprojects(projectId);
        setSubprojects(rows);
        setSubprojectId(result.newId);
      }
      // Propagar a las vistas que dependen de la jerarquía.
      await Promise.all(
        TASK_INVALIDATION_KEYS.map((k) =>
          queryClient.invalidateQueries({ queryKey: k as unknown as string[] }),
        ),
      );
      toast.success(
        `Estructura reutilizada · ${result.counts.subprojects} subproyectos, ${result.counts.tasks} tareas.`,
      );
      setSuggestion(null);
      setInlineOpen(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo reutilizar la estructura.";
      setInlineError(msg);
    } finally {
      setSuggestionBusy(false);
    }
  }

  /** El usuario rechaza la sugerencia y continúa con la creación normal. */
  async function handleCreateFromScratch() {
    if (!inlineOpen) return;
    const name = inlineName.trim();
    // Recordar el rechazo para no volver a insistir con el mismo nombre/scope.
    setRejectedSuggestions((prev) => {
      const next = new Set(prev);
      next.add(suggestionKey(inlineOpen, name));
      return next;
    });
    setSuggestion(null);
    setInlineSaving(true);
    setInlineError(null);
    try {
      await performInlineCreate(name);
      setInlineOpen(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear.";
      setInlineError(msg);
    } finally {
      setInlineSaving(false);
    }
  }

  const isEvento = activityType === "evento";

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!areaId) next.area = "Selecciona un área.";
    if (!projectId) next.project = "Selecciona un proyecto.";
    if (!subprojectId) next.subproject = "Selecciona un subproyecto.";
    if (!title.trim()) next.title = "Escribe un título.";
    if (isEvento) {
      if (!fecha) next.fecha = "Un evento necesita una fecha.";
      if (!hora) next.hora = "Un evento necesita una hora de inicio.";
      if (!horaFin) next.horaFin = "Un evento necesita una hora de fin.";
      if (fecha && hora && horaFin) {
        const s = new Date(`${fecha}T${hora}:00`);
        const e = new Date(`${fecha}T${horaFin}:00`);
        if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e <= s) {
          next.horaFin = "La hora de fin debe ser posterior al inicio.";
        }
      }
    }
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

  function buildEndsAt(): string | null {
    if (!isEvento) return null;
    if (!fecha || !horaFin) return null;
    const d = new Date(`${fecha}T${horaFin}:00`);
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
      const endsAt = buildEndsAt();
      // Los eventos derivan su duración de ends_at; no persistimos estimación.
      const duracionNum = isEvento ? null : duracion ? Number(duracion) : null;
      const dbActivityType = ACTIVITY_TYPE_DB[activityType];

      // Pre-chequeo de conflicto para dar un mensaje concreto al usuario.
      // La garantía real vive en el trigger de Supabase (SQLSTATE CA001),
      // que también protege contra escrituras concurrentes.
      if (isEvento && startsAt && endsAt) {
        const excludeId = isEdit ? initialTask?.task.id ?? null : null;
        const conflict = await findEventConflict(startsAt, endsAt, excludeId);
        if (conflict) {
          showConflict(conflict);
          setSaving(false);
          return;
        }
      }

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
          ends_at: endsAt,
          activity_type: dbActivityType,
          estimated_duration_min: duracionNum,
          completed_at: nextCompletedAt,
        });
        toast.success(isEvento ? "Evento actualizado." : "Tarea actualizada.");
      } else {
        const input: CreateTaskInput = {
          subproject_id: subprojectId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status,
          source: "manual",
          starts_at: startsAt,
          ends_at: endsAt,
          activity_type: dbActivityType,
          estimated_duration_min: duracionNum,
        };
        saved = await createTask(input);
        toast.success(isEvento ? "Evento creado." : "Tarea creada.");
      }
      await invalidateAll();
      onSaved?.(saved);
    } catch (err) {
      // Si el trigger rechazó el guardado por solape (carrera con otro
      // cliente o cambio entre pre-chequeo y guardado), traducimos el
      // error a un mensaje humano y marcamos los campos de horario.
      const conflict = parseEventConflictError(err);
      if (conflict || (err as { code?: string })?.code === "CA001") {
        showConflict(conflict);
      } else {
        const msg = err instanceof Error ? err.message : "No se pudo guardar.";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  /** Muestra el mensaje de conflicto y marca los campos de horario. */
  function showConflict(conflict: EventConflict | null) {
    const message = buildConflictMessage(conflict);
    const fieldHint = "Este horario coincide con otro evento.";
    setErrors((prev) => ({
      ...prev,
      hora: fieldHint,
      horaFin: fieldHint,
      conflict: message,
    }));
    toast.error(message, { duration: 8000 });
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
          {/* 0. Tipo de actividad — Tarea vs Evento */}
          <section aria-label="Tipo de actividad">
            <div
              role="tablist"
              aria-label="Tipo de actividad"
              className="inline-flex w-full rounded-lg bg-muted p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isEvento}
                onClick={() => setActivityType("tarea")}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  !isEvento
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tarea
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isEvento}
                onClick={() => setActivityType("evento")}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isEvento
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Evento
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isEvento
                ? "Bloque horario con inicio y fin. Aparece en el Calendario."
                : "Unidad flexible. Puede tener fecha o quedar sin programar."}
            </p>
          </section>

          {/* 1. Información */}
          <section className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="td-title">Título *</Label>
              <Input
                id="td-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isEvento ? "Nombra tu evento" : "Nombra tu tarea"}
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
            <h2 className="text-sm font-medium text-muted-foreground">
              {isEvento ? "Cuándo ocurre" : "Programación"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isEvento
                ? "Un evento requiere fecha, hora de inicio y hora de fin."
                : "Sin fecha, la tarea no aparecerá en el Calendario."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="td-fecha">
                  Fecha{isEvento ? " *" : ""}
                </Label>
                <Input
                  id="td-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
                {errors.fecha && (
                  <p className="text-xs text-destructive">{errors.fecha}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="td-hora">
                  {isEvento ? "Inicio *" : "Hora"}
                </Label>
                <Input
                  id="td-hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
                {errors.hora && (
                  <p className="text-xs text-destructive">{errors.hora}</p>
                )}
              </div>
            </div>

            {isEvento ? (
              <div className="space-y-2">
                <Label htmlFor="td-hora-fin">Fin *</Label>
                <Input
                  id="td-hora-fin"
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
                {errors.horaFin && (
                  <p className="text-xs text-destructive">{errors.horaFin}</p>
                )}
              </div>
            ) : (
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
            )}
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
                : isEvento
                  ? "Guardar evento"
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

      {/* Sugerencia de reutilización — Memoria Inteligente */}
      <ReuseStructureDialog
        open={suggestion !== null}
        match={suggestion}
        newName={inlineName}
        busy={suggestionBusy}
        onReuse={handleReuseSuggestion}
        onCreateFromScratch={handleCreateFromScratch}
      />



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
