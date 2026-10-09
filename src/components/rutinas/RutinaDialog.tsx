/**
 * ========================================================
 * Componente: RutinaDialog — crear o editar una Rutina
 *
 * - Crear: dentro de una Dimensión (Tablero o Ajustes → Organización).
 *   Muestra su propio botón "+ Rutina".
 * - Editar: se abre desde la fila de la Rutina (controlado por props),
 *   con su cumplimiento del mes y la opción de archivarla.
 *
 * Campos: nombre, días de la semana, hora (opcional), duración,
 * prioridad, etiquetas y nota. Con hora y duración, cada día se crea
 * como evento; sin hora, como tarea del día.
 * ========================================================
 */
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagPicker } from "@/components/etiquetas/TagPicker";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";
import {
  archiveRoutine,
  createRoutine,
  DIAS_SEMANA,
  updateRoutine,
  type RutinaNode,
} from "@/services/routineService";

type Priority = RutinaNode["prioridad"];

type Props =
  | {
      mode: "create";
      areaId: string;
      dimensionId: string;
      triggerLabel?: string;
      triggerClassName?: string;
    }
  | {
      mode: "edit";
      rutina: RutinaNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

export function RutinaDialog(props: Props) {
  const qc = useQueryClient();
  const isEdit = props.mode === "edit";
  const rutina = isEdit ? props.rutina : null;

  const [innerOpen, setInnerOpen] = useState(false);
  const open = isEdit ? props.open : innerOpen;
  const setOpen = isEdit ? props.onOpenChange : setInnerOpen;

  const [nombre, setNombre] = useState("");
  const [dias, setDias] = useState<number[]>([]);
  const [hora, setHora] = useState("");
  const [duracion, setDuracion] = useState("");
  const [prioridad, setPrioridad] = useState<Priority>("medium");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [nota, setNota] = useState("");

  // Al abrir, cargar los datos (o limpiar si es nueva).
  useEffect(() => {
    if (!open) return;
    setNombre(rutina?.nombre ?? "");
    setDias(rutina?.diasSemana ?? []);
    setHora(rutina?.hora ?? "");
    setDuracion(rutina?.duracionMin ? String(rutina.duracionMin) : "");
    setPrioridad(rutina?.prioridad ?? "medium");
    setTagIds(rutina?.tagIds ?? []);
    setNota(rutina?.descripcion ?? "");
    // Sólo al abrir o cambiar de rutina: un refresco del Tablero con el
    // diálogo abierto no debe borrar lo que se está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rutina?.id]);

  function toggleDia(d: number) {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  const duracionNum = duracion.trim() ? Math.round(Number(duracion)) : null;
  const duracionValida = duracionNum === null || (Number.isFinite(duracionNum) && duracionNum > 0);

  const guardar = useMutation({
    mutationFn: async () => {
      const name = nombre.trim();
      if (!name) throw new Error("Ponle un nombre a la rutina.");
      if (dias.length === 0) throw new Error("Elige al menos un día de la semana.");
      if (!duracionValida) throw new Error("La duración debe ser un número de minutos.");
      const fields = {
        name,
        weekdays: dias,
        start_time: hora || null,
        duration_min: duracionNum,
        priority: prioridad,
        tag_ids: tagIds,
        description: nota.trim() || null,
      };
      if (isEdit && rutina) return updateRoutine(rutina.id, fields);
      if (props.mode !== "create") throw new Error("Falta la dimensión.");
      return createRoutine({ ...fields, area_id: props.areaId, dimension_id: props.dimensionId });
    },
    onSuccess: async () => {
      toast.success(isEdit ? "Rutina guardada." : "Rutina creada.");
      await invalidateActivityGraph(qc);
      setOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la rutina.");
    },
  });

  const archivar = useMutation({
    mutationFn: () => archiveRoutine(rutina!.id),
    onSuccess: async () => {
      toast.success("Rutina archivada. Sus tareas pasadas se mantienen.");
      await invalidateActivityGraph(qc);
      setOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "No se pudo archivar.");
    },
  });

  const busy = guardar.isPending || archivar.isPending;
  const mes = rutina?.mes;

  return (
    <>
      {props.mode === "create" ? (
        <button
          type="button"
          onClick={() => setInnerOpen(true)}
          className={
            props.triggerClassName ??
            "flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
          }
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {props.triggerLabel ?? "Nueva Rutina"}
        </button>
      ) : null}

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? rutina?.nombre : "Nueva Rutina"}</DialogTitle>
            <DialogDescription>
              {isEdit && mes
                ? mes.esperadas > 0
                  ? `Este mes: ${mes.hechas} de ${mes.esperadas}${
                      mes.minutos > 0 ? ` · ${fmtMin(mes.minutos)} dedicadas` : ""
                    }${mes.noHechas > 0 ? ` · ${mes.noHechas} sin hacer` : ""}.`
                  : "Este mes todavía no le ha tocado."
                : "Una actividad que se repite cada semana. Sus tareas se proponen en el Ritual del domingo."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              guardar.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="rutina-nombre">Nombre</Label>
              <Input
                id="rutina-nombre"
                autoFocus={!isEdit}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                placeholder="Ej. Historias de Instagram"
              />
            </div>

            <div className="space-y-2">
              <Label>Días</Label>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map(({ label, dia }) => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDia(dia)}
                    aria-pressed={dias.includes(dia)}
                    className={`h-10 w-10 rounded-full text-sm font-medium transition-colors ${
                      dias.includes(dia)
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rutina-hora">Hora (opcional)</Label>
                <Input
                  id="rutina-hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rutina-duracion">Duración (min)</Label>
                <Input
                  id="rutina-duracion"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={duracion}
                  onChange={(e) => setDuracion(e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-slate-500">
              {hora && duracionNum
                ? "Con hora y duración, cada día se agenda como evento en el Calendario."
                : "Sin hora, cada día se crea como tarea de ese día."}
            </p>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as Priority)}>
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

            <TagPicker value={tagIds} onChange={setTagIds} disabled={busy} />

            <div className="space-y-2">
              <Label htmlFor="rutina-nota">Nota (opcional)</Label>
              <Textarea
                id="rutina-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Qué incluye, cómo se hace…"
              />
            </div>

            {isEdit ? (
              <p className="text-xs text-slate-500">
                Los cambios se aplican a las próximas semanas; las tareas ya creadas no cambian.
              </p>
            ) : null}

            <DialogFooter className="gap-2 sm:justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-500"
                  disabled={busy}
                  onClick={() => archivar.mutate()}
                >
                  Archivar
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={!nombre.trim() || dias.length === 0 || busy}>
                  {isEdit ? "Guardar" : "Crear"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
