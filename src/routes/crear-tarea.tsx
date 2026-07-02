/**
 * ========================================================
 * Ruta: /crear-tarea
 *
 * Pantalla "Crear tarea" (mobile-first).
 *
 * Reglas arquitectónicas:
 * - Toda escritura pasa exclusivamente por `taskService.createTask(CreateTaskInput)`.
 * - Nunca accede directamente a Supabase desde la UI.
 * - Nunca envía `user_id` — lo resuelve el servicio.
 * - Áreas / Proyectos / Subproyectos se obtienen mediante los servicios
 *   asíncronos (`fetchAreas`, `fetchProjects`, `fetchSubprojects`).
 *
 * Preparación para IA (futuras iteraciones — sin modificar esta pantalla):
 * - La sección "Captura" contiene el texto crudo (voz o escritura).
 * - Al pulsar "Continuar" se abre la sección "Interpretación", que hoy
 *   simplemente copia el texto al título. En el futuro, un servicio
 *   `interpretationService` reemplazará esta función copiando en los
 *   campos: título, descripción, área, proyecto, subproyecto, fecha,
 *   hora, duración y prioridad. La estructura ya está preparada.
 * - Los botones "🎤 Dictar" y "⌨️ Escribir" quedan como puntos de
 *   entrada listos para conectar Whisper en el futuro.
 * ========================================================
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Keyboard, Mic, Paperclip, Plus, Trash2 } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { fetchAreas, createArea } from "@/services/areaService";
import { fetchProjects, createProject } from "@/services/projectService";
import { fetchSubprojects, createSubproject } from "@/services/subprojectService";
import {
  createTask,
  type CreateTaskInput,
  type TaskPriority,
  type TaskStatus,
} from "@/services/taskService";
import type { AreaRow, ProjectRow, SubprojectRow } from "@/types/tarea";

type InlineKind = "area" | "project" | "subproject" | null;

export const Route = createFileRoute("/crear-tarea")({
  head: () => ({ meta: [{ title: "Crear tarea — CalmApp" }] }),
  component: CrearTareaScreen,
});

interface Reminder {
  id: string;
  offsetMin: number;
}

function CrearTareaScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Captura
  const [captura, setCaptura] = useState("");
  const [interpretado, setInterpretado] = useState(false);

  // Organización
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [subprojects, setSubprojects] = useState<SubprojectRow[]>([]);
  const [areaId, setAreaId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [subprojectId, setSubprojectId] = useState<string>("");

  // Información de la tarea
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  // Estado inicial: pending por defecto; "waiting" si la tarea nace detenida
  // a la espera de un tercero (aparece automáticamente en la columna ESPERANDO).
  const [status, setStatus] = useState<TaskStatus>("pending");

  // Programación
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [duracion, setDuracion] = useState<string>("");

  // Recordatorios: UI deshabilitada hasta que exista persistencia en task_reminders.
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Creación inline
  const [inlineOpen, setInlineOpen] = useState<InlineKind>(null);
  const [inlineName, setInlineName] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

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
      } else if (inlineOpen === "project") {
        if (!areaId) throw new Error("Selecciona un área primero.");
        const created = await createProject({ name, area_id: areaId });
        const rows = await fetchProjects(areaId);
        setProjects(rows);
        setProjectId(created.id);
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


  // ---- Carga inicial de áreas
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

  // ---- Cadena Área → Proyecto
  useEffect(() => {
    setProjectId("");
    setSubprojectId("");
    setProjects([]);
    setSubprojects([]);
    if (!areaId) return;
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

  // ---- Cadena Proyecto → Subproyecto
  useEffect(() => {
    setSubprojectId("");
    setSubprojects([]);
    if (!projectId) return;
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

  const canContinue = useMemo(() => captura.trim().length > 0, [captura]);

  function handleContinue() {
    if (!canContinue) return;
    // Interpretación stub (sin IA): copiar la captura como título sugerido.
    // El resto de campos quedan vacíos, listos para que OpenAI los complete
    // en una futura iteración sin modificar esta pantalla.
    if (!title.trim()) setTitle(captura.trim());
    setInterpretado(true);
  }

  function addReminder() {
    setReminders((prev) => [
      ...prev,
      { id: crypto.randomUUID(), offsetMin: 15 },
    ]);
  }

  function updateReminder(id: string, offsetMin: number) {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, offsetMin } : r)));
  }

  function removeReminder(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
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
    // Si hay hora → combinar; sin hora → 00:00 local (evento "todo el día").
    const iso = hora ? `${fecha}T${hora}:00` : `${fecha}T00:00:00`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const input: CreateTaskInput = {
        subproject_id: subprojectId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        source: "manual",
        starts_at: buildStartsAt(),
        estimated_duration_min: duracion ? Number(duracion) : null,
      };
      await createTask(input);
      // Invalida la caché de FOCO para que la nueva tarea aparezca de
      // inmediato en la columna correspondiente sin refrescar la página.
      await queryClient.invalidateQueries({ queryKey: ["focus"] });
      toast.success("Tarea creada correctamente.");
      navigate({ to: "/foco" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear la tarea.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Crear tarea</h1>
          <p className="text-sm text-muted-foreground">
            Escribe con calma. Ya la organizaremos.
          </p>
        </header>

        {/* 1. Captura */}
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="text-base font-medium">¿Qué necesitas recordar?</h2>
          <Textarea
            value={captura}
            onChange={(e) => setCaptura(e.target.value)}
            placeholder="Escribe o dicta lo que necesitas hacer..."
            className="min-h-32 resize-none"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled>
              <Mic className="h-4 w-4" /> Dictar
            </Button>
            <Button type="button" variant="outline" className="flex-1">
              <Keyboard className="h-4 w-4" /> Escribir
            </Button>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={handleContinue}
            disabled={!canContinue}
          >
            Continuar
          </Button>
        </section>

        {interpretado && (
          <>
            {/* 2. Interpretación */}
            <section className="rounded-xl border bg-card p-4 space-y-2">
              <h2 className="text-base font-medium">Interpretación</h2>
              <p className="text-xs text-muted-foreground">
                Por ahora usamos tu texto como título sugerido. Pronto lo
                interpretaremos automáticamente.
              </p>
            </section>

            {/* 3. Organización */}
            <section className="rounded-xl border bg-card p-4 space-y-4">
              <h2 className="text-base font-medium">Organización</h2>

              {areasLoading ? (
                <p className="text-sm text-muted-foreground">
                  Cargando estructura organizacional…
                </p>
              ) : (
                <>
                  {/* Área */}
                  <div className="space-y-2">
                    <Label>Área *</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select
                          value={areaId}
                          onValueChange={setAreaId}
                          disabled={areas.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                areas.length === 0
                                  ? "Aún no tienes áreas"
                                  : "Selecciona un área"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {areas.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openInline("area")}
                      >
                        <Plus className="h-4 w-4" /> Nueva área
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
                          onValueChange={setProjectId}
                          disabled={!areaId || projects.length === 0}
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
                        onClick={() => openInline("project")}
                        disabled={!areaId}
                      >
                        <Plus className="h-4 w-4" /> Nuevo proyecto
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
                          disabled={!projectId || subprojects.length === 0}
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
                        onClick={() => openInline("subproject")}
                        disabled={!projectId}
                      >
                        <Plus className="h-4 w-4" /> Nuevo subproyecto
                      </Button>
                    </div>
                    {errors.subproject && (
                      <p className="text-xs text-destructive">{errors.subproject}</p>
                    )}
                  </div>
                </>
              )}
            </section>


            {/* 4. Información de la tarea */}
            <section className="rounded-xl border bg-card p-4 space-y-4">
              <h2 className="text-base font-medium">Información</h2>

              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nombra tu tarea"
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles opcionales"
                  className="min-h-24 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
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

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as TaskStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="waiting">Esperando</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Elige "Esperando" si la tarea depende de un tercero o de una respuesta externa.
                </p>
              </div>
            </section>

            {/* 5. Programación */}
            <section className="rounded-xl border bg-card p-4 space-y-4">
              <h2 className="text-base font-medium">Programación</h2>
              <p className="text-xs text-muted-foreground">
                Sin fecha, la tarea no aparecerá en el Calendario.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora">Hora</Label>
                  <Input
                    id="hora"
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duracion">Duración estimada (min)</Label>
                <Input
                  id="duracion"
                  type="number"
                  min={0}
                  value={duracion}
                  onChange={(e) => setDuracion(e.target.value)}
                  placeholder="Ej: 30"
                />
              </div>
            </section>

            {/* 6. Recordatorios
                Sección deshabilitada temporalmente: los recordatorios se
                persistirán en la tabla `task_reminders` cuando se implemente
                su backend. Se oculta para evitar expectativas de guardado. */}
            {/*
            <section className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium">Recordatorios</h2>
                <Button type="button" size="sm" variant="outline" onClick={addReminder}>
                  <Plus className="h-4 w-4" /> Agregar
                </Button>
              </div>
              {reminders.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin recordatorios por ahora.
                </p>
              ) : (
                <ul className="space-y-2">
                  {reminders.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={r.offsetMin}
                        onChange={(e) =>
                          updateReminder(r.id, Number(e.target.value) || 0)
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        min antes
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeReminder(r.id)}
                        aria-label="Eliminar recordatorio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            */}

            {/* 7. Adjuntos */}
            <section className="rounded-xl border bg-card p-4 space-y-3">
              <h2 className="text-base font-medium">Adjuntos</h2>
              <Button type="button" variant="outline" className="w-full" disabled>
                <Paperclip className="h-4 w-4" /> Agregar archivo
              </Button>
              <p className="text-xs text-muted-foreground">
                Disponible próximamente.
              </p>
            </section>
          </>
        )}
      </div>

      {/* Botón fijo inferior */}
      {interpretado && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur px-4 py-3 md:pl-64">
          <div className="mx-auto max-w-2xl">
            <Button
              type="button"
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar tarea"}
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de creación inline (Área / Proyecto / Subproyecto) */}
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
    </div>

  );
}
