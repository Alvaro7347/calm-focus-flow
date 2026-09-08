/**
 * ========================================================
 * Componente: CrearNodoDialog
 *
 * Responsabilidad:
 * Creación "de arriba hacia abajo" de la jerarquía organizacional
 * (Área → Proyecto → Etapa) desde Ajustes → Organización, SIN
 * pasar por el flujo de "Crear tarea".
 *
 * Antes de este componente, `TaskDetailForm` era el único lugar
 * de la app donde podían nacer Áreas/Proyectos/Etapas (creación
 * "de abajo hacia arriba", como efecto secundario de crear una
 * tarea). Esto no sirve cuando se conoce la estructura de un
 * proyecto (ej. sus Etapas) antes de tener ninguna tarea concreta.
 *
 * Un mismo componente cubre los 3 niveles vía `type`:
 * - "area": pide nombre + color (paleta CalmApp).
 * - "project": pide nombre + fecha objetivo + visión (opcionales).
 * - "subproject" (Etapa): pide nombre + fecha objetivo (opcional).
 * ========================================================
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createArea } from "@/services/areaService";
import { createProject } from "@/services/projectService";
import { createSubproject } from "@/services/subprojectService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";
import {
  PROJECT_COLORS,
  DEFAULT_PROJECT_COLOR,
  type ProjectColorSlug,
} from "@/lib/projectIdentity";

export type CrearNodoTipo = "area" | "project" | "subproject";

const TITULOS: Record<CrearNodoTipo, string> = {
  area: "Nueva Área",
  project: "Nuevo Proyecto",
  subproject: "Nueva Etapa",
};

interface Props {
  type: CrearNodoTipo;
  /** area_id (si type="project") o project_id (si type="subproject"). No aplica para type="area". */
  parentId?: string;
  /** Texto del botón disparador. Por defecto usa el título del tipo. */
  triggerLabel?: string;
  className?: string;
}

export function CrearNodoDialog({ type, parentId, triggerLabel, className }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState<ProjectColorSlug>(DEFAULT_PROJECT_COLOR);
  const [fecha, setFecha] = useState("");
  const [vision, setVision] = useState("");

  function reset() {
    setNombre("");
    setColor(DEFAULT_PROJECT_COLOR);
    setFecha("");
    setVision("");
  }

  const crear = useMutation({
    mutationFn: async () => {
      const trimmed = nombre.trim();
      if (!trimmed) throw new Error("El nombre no puede estar vacío.");

      if (type === "area") {
        return createArea({ name: trimmed, color });
      }
      if (type === "project") {
        if (!parentId) throw new Error("Falta el área destino.");
        return createProject({
          area_id: parentId,
          name: trimmed,
          target_date: fecha || null,
          vision_text: vision.trim() || null,
        });
      }
      if (!parentId) throw new Error("Falta el proyecto destino.");
      return createSubproject({
        project_id: parentId,
        name: trimmed,
        target_date: fecha || null,
      });
    },
    onSuccess: async () => {
      await invalidateActivityGraph(qc);
      toast.success(`${TITULOS[type]} creada.`);
      reset();
      setOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "No se pudo crear.");
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex items-center gap-1.5 py-2 px-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
        }
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {triggerLabel ?? TITULOS[type]}
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{TITULOS[type]}</DialogTitle>
            <DialogDescription>
              {type === "area" &&
                "Se crea directamente, sin necesidad de asignarle ninguna tarea todavía."}
              {type === "project" &&
                "Puedes definir su visión y fecha objetivo ahora, o dejarlas para después."}
              {type === "subproject" &&
                "Crea la Etapa aunque todavía no sepas qué tareas tendrá."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="crear-nodo-nombre">Nombre</Label>
              <Input
                id="crear-nodo-nombre"
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                placeholder={
                  type === "area" ? "Ej: Negocio" : type === "project" ? "Ej: Saint George" : "Ej: Prospección"
                }
              />
            </div>

            {type === "area" && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Color</p>
                <div role="radiogroup" aria-label="Color del área" className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      role="radio"
                      aria-checked={color === c.slug}
                      title={c.label}
                      onClick={() => setColor(c.slug)}
                      className={`h-6 w-6 rounded-full ${c.dot} ${
                        color === c.slug ? "ring-2 ring-offset-2 ring-slate-400" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {(type === "project" || type === "subproject") && (
              <div className="space-y-2">
                <Label htmlFor="crear-nodo-fecha">Fecha objetivo (opcional)</Label>
                <Input
                  id="crear-nodo-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            )}

            {type === "project" && (
              <div className="space-y-2">
                <Label htmlFor="crear-nodo-vision">Visión (opcional)</Label>
                <Textarea
                  id="crear-nodo-vision"
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  placeholder="¿Cómo se ve/siente llegar a este Proyecto?"
                  rows={3}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={crear.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!nombre.trim() || crear.isPending}>
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
