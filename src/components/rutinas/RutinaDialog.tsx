/**
 * ========================================================
 * Componente: RutinaDialog — crear o editar una Rutina
 *
 * - Crear: con su propio botón "+ Rutina" (Tablero, Organización) o
 *   controlado desde afuera (Crear tarea → Vincular a → Rutina → "+").
 *   Puede venir con Dimensión, Objetivo o Meta preseleccionados.
 * - Editar: se abre desde la fila de la Rutina, con su cumplimiento
 *   del período, su próxima fecha y la opción de archivarla.
 *
 * Campos:
 * - Nombre.
 * - Se repite: semanal (días, cada N semanas) o mensual (día del mes o
 *   último día, cada N meses), a partir de una fecha.
 * - Hora (opcional) y duración. Con ambas, cada vez se agenda como
 *   evento; si no, como tarea del día.
 * - De dónde cuelga: Dimensión y/o Objetivo (y Meta). Al menos uno.
 * - Prioridad, etiquetas y nota.
 * ========================================================
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { fetchAreaTree, type AreaNode } from "@/services/tableroService";
import {
  archiveRoutine,
  createRestOfThisWeek,
  createRoutine,
  DIAS_SEMANA,
  describeRegla,
  fechaCorta,
  nextOccurrence,
  updateRoutine,
  type Frecuencia,
  type RoutineRow,
  type RutinaNode,
  type RutinaRegla,
} from "@/services/routineService";

type Priority = RutinaNode["prioridad"];

const NINGUNO = "__none__";

type CreateProps = {
  mode: "create";
  areaId: string;
  dimensionId?: string | null;
  objectiveId?: string | null;
  goalId?: string | null;
  triggerLabel?: string;
  triggerClassName?: string;
  /** Si se pasa, el diálogo es controlado y no muestra su botón. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Crear al tiro lo que queda de esta semana (por defecto sí). Desde
   * Crear tarea es `false`: la tarea que se está creando es la primera.
   */
  generarSemana?: boolean;
  onCreated?: (row: RoutineRow) => void;
};

type Props =
  | CreateProps
  | {
      mode: "edit";
      rutina: RutinaNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RutinaDialog(props: Props) {
  const qc = useQueryClient();
  const isEdit = props.mode === "edit";
  const rutina = isEdit ? props.rutina : null;
  const create = props.mode === "create" ? props : null;
  const controlled = isEdit || create?.open !== undefined;

  const [innerOpen, setInnerOpen] = useState(false);
  const open = isEdit ? props.open : (create?.open ?? innerOpen);
  const setOpen = (v: boolean) => {
    if (isEdit) props.onOpenChange(v);
    else if (create?.onOpenChange) create.onOpenChange(v);
    if (!controlled) setInnerOpen(v);
  };

  const areaId = rutina?.areaId ?? create!.areaId;

  // Dimensiones, Objetivos y Metas del Área (misma query del Tablero).
  const { data: tree = [] } = useQuery<AreaNode[]>({
    queryKey: ["tablero"],
    queryFn: fetchAreaTree,
    staleTime: 60_000,
    enabled: open,
  });
  const area = tree.find((a) => a.id === areaId);
  const dimensiones = area?.dimensiones ?? [];
  const objetivos = area?.objetivos ?? [];

  const [nombre, setNombre] = useState("");
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("weekly");
  const [intervalo, setIntervalo] = useState("1");
  const [dias, setDias] = useState<number[]>([]);
  const [diaMes, setDiaMes] = useState("1");
  const [ultimoDia, setUltimoDia] = useState(false);
  const [inicio, setInicio] = useState(hoyIso());
  const [hora, setHora] = useState("");
  const [duracion, setDuracion] = useState("");
  const [dimensionId, setDimensionId] = useState<string>(NINGUNO);
  const [objectiveId, setObjectiveId] = useState<string>(NINGUNO);
  const [goalId, setGoalId] = useState<string>(NINGUNO);
  const [prioridad, setPrioridad] = useState<Priority>("medium");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [nota, setNota] = useState("");

  // Al abrir, cargar los datos (o los valores iniciales si es nueva).
  useEffect(() => {
    if (!open) return;
    setNombre(rutina?.nombre ?? "");
    setFrecuencia(rutina?.frecuencia ?? "weekly");
    setIntervalo(String(rutina?.intervalo ?? 1));
    setDias(rutina?.diasSemana ?? []);
    setDiaMes(rutina?.diaMes && rutina.diaMes > 0 ? String(rutina.diaMes) : "1");
    setUltimoDia(rutina?.diaMes === -1);
    setInicio(rutina?.inicio ?? hoyIso());
    setHora(rutina?.hora ?? "");
    setDuracion(rutina?.duracionMin ? String(rutina.duracionMin) : "");
    setDimensionId(rutina?.dimensionId ?? create?.dimensionId ?? NINGUNO);
    setObjectiveId(rutina?.objectiveId ?? create?.objectiveId ?? NINGUNO);
    setGoalId(rutina?.goalId ?? create?.goalId ?? NINGUNO);
    setPrioridad(rutina?.prioridad ?? "medium");
    setTagIds(rutina?.tagIds ?? []);
    setNota(rutina?.descripcion ?? "");
    // Sólo al abrir o cambiar de rutina: un refresco con el diálogo
    // abierto no debe borrar lo que se está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rutina?.id]);

  // Objetivo preseleccionado sin Dimensión: tomar la del Objetivo.
  useEffect(() => {
    if (!open || dimensionId !== NINGUNO || objectiveId === NINGUNO) return;
    const dim = objetivos.find((o) => o.id === objectiveId)?.dimensionId;
    if (dim) setDimensionId(dim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, objectiveId, objetivos.length]);

  const metas = objetivos.find((o) => o.id === objectiveId)?.metas ?? [];

  function elegirObjetivo(v: string) {
    setObjectiveId(v);
    setGoalId(NINGUNO);
    const dim = objetivos.find((o) => o.id === v)?.dimensionId;
    if (v !== NINGUNO && dim && dimensionId === NINGUNO) setDimensionId(dim);
  }

  function toggleDia(d: number) {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  const intervaloNum = Math.min(24, Math.max(1, Math.round(Number(intervalo) || 1)));
  const diaMesNum = Math.min(31, Math.max(1, Math.round(Number(diaMes) || 1)));
  const duracionNum = duracion.trim() ? Math.round(Number(duracion)) : null;
  const duracionValida = duracionNum === null || (Number.isFinite(duracionNum) && duracionNum > 0);

  const regla: RutinaRegla = useMemo(
    () => ({
      frecuencia,
      intervalo: intervaloNum,
      diasSemana: frecuencia === "weekly" ? dias : [],
      diaMes: frecuencia === "monthly" ? (ultimoDia ? -1 : diaMesNum) : null,
      inicio: inicio || hoyIso(),
    }),
    [frecuencia, intervaloNum, dias, ultimoDia, diaMesNum, inicio],
  );
  const reglaCompleta = frecuencia === "monthly" || dias.length > 0;
  const proxima = reglaCompleta ? nextOccurrence(regla) : null;
  const tienePadre = dimensionId !== NINGUNO || objectiveId !== NINGUNO;

  const guardar = useMutation({
    mutationFn: async () => {
      const name = nombre.trim();
      if (!name) throw new Error("Ponle un nombre a la rutina.");
      if (!reglaCompleta) throw new Error("Elige al menos un día de la semana.");
      if (!tienePadre) throw new Error("Elige una dimensión o un objetivo.");
      if (!duracionValida) throw new Error("La duración debe ser un número de minutos.");
      const fields = {
        name,
        frequency: frecuencia,
        interval_count: intervaloNum,
        weekdays: regla.diasSemana,
        month_day: regla.diaMes,
        start_date: regla.inicio,
        start_time: hora || null,
        duration_min: duracionNum,
        dimension_id: dimensionId === NINGUNO ? null : dimensionId,
        objective_id: objectiveId === NINGUNO ? null : objectiveId,
        goal_id: objectiveId === NINGUNO || goalId === NINGUNO ? null : goalId,
        priority: prioridad,
        tag_ids: tagIds,
        description: nota.trim() || null,
      };
      if (isEdit && rutina) {
        await updateRoutine(rutina.id, fields);
        return null;
      }
      const row = await createRoutine({ ...fields, area_id: areaId });
      create?.onCreated?.(row);
      if (create?.generarSemana === false) return { created: 0, failed: [], omitida: true };
      // Lo que queda de esta semana se crea ya; lo demás, en el Ritual.
      return { ...(await createRestOfThisWeek(row)), omitida: false };
    },
    onSuccess: async (semana) => {
      if (!semana) {
        toast.success("Rutina guardada.");
      } else if (semana.omitida) {
        toast.success("Rutina creada.");
      } else if (semana.created > 0) {
        toast.success(
          semana.created === 1
            ? "Rutina creada. Se agregó 1 vez de esta semana."
            : `Rutina creada. Se agregaron ${semana.created} veces de esta semana.`,
        );
      } else {
        toast.success(
          "Rutina creada. Se agrega en el Ritual del domingo de la semana que le toque.",
        );
      }
      if (semana && semana.failed.length > 0) {
        toast.warning(
          `No se crearon: ${semana.failed.map((f) => `${f.title} (${f.reason})`).join(" · ")}`,
        );
      }
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

  const chip = (on: boolean) =>
    `min-h-[40px] rounded-full px-4 text-sm font-medium transition-colors ${
      on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <>
      {create && !controlled ? (
        <button
          type="button"
          onClick={() => setInnerOpen(true)}
          className={
            create.triggerClassName ??
            "flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
          }
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {create.triggerLabel ?? "Nueva Rutina"}
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
                ? `${
                    mes.esperadas > 0
                      ? `${mes.periodo}: ${mes.hechas} de ${mes.esperadas}${
                          mes.minutos > 0 ? ` · ${fmtMin(mes.minutos)} dedicadas` : ""
                        }${mes.noHechas > 0 ? ` · ${mes.noHechas} sin hacer` : ""}.`
                      : `${mes.periodo}: todavía no le ha tocado.`
                  }${rutina?.proxima ? ` Próxima vez: ${fechaCorta(rutina.proxima)}.` : ""}`
                : "Algo que se repite. Lo que le toca esta semana se crea al tiro; desde la próxima, se propone en el Ritual del domingo."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              // Puede abrirse desde otro formulario (Crear tarea): que no lo envíe.
              e.stopPropagation();
              guardar.mutate();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="rutina-nombre">Nombre</Label>
              <Input
                id="rutina-nombre"
                autoFocus={!isEdit}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                placeholder="Ej. Pagar IVA"
              />
            </div>

            {/* ---------- Se repite ---------- */}
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">Se repite</legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={chip(frecuencia === "weekly")}
                  aria-pressed={frecuencia === "weekly"}
                  onClick={() => setFrecuencia("weekly")}
                >
                  Semanal
                </button>
                <button
                  type="button"
                  className={chip(frecuencia === "monthly")}
                  aria-pressed={frecuencia === "monthly"}
                  onClick={() => setFrecuencia("monthly")}
                >
                  Mensual
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span>Cada</span>
                <Input
                  aria-label="Cada cuántas"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={24}
                  value={intervalo}
                  onChange={(e) => setIntervalo(e.target.value)}
                  className="h-10 w-16 text-center"
                />
                <span>
                  {frecuencia === "weekly"
                    ? intervaloNum === 1
                      ? "semana"
                      : "semanas"
                    : intervaloNum === 1
                      ? "mes"
                      : "meses"}
                </span>
              </div>

              {frecuencia === "weekly" ? (
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
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <span>El día</span>
                  <Input
                    aria-label="Día del mes"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    value={diaMes}
                    disabled={ultimoDia}
                    onChange={(e) => setDiaMes(e.target.value)}
                    className="h-10 w-16 text-center"
                  />
                  <span>o</span>
                  <button
                    type="button"
                    className={chip(ultimoDia)}
                    aria-pressed={ultimoDia}
                    onClick={() => setUltimoDia((v) => !v)}
                  >
                    Último día del mes
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Label htmlFor="rutina-inicio" className="font-normal">
                  A partir del
                </Label>
                <Input
                  id="rutina-inicio"
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="h-10 w-auto"
                />
              </div>

              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {reglaCompleta
                  ? `${describeRegla(regla)}.${proxima ? ` Primera vez: ${fechaCorta(proxima)}.` : ""}`
                  : "Elige los días de la semana."}
                {frecuencia === "monthly" && !ultimoDia && diaMesNum > 28
                  ? " Si el mes es más corto, cae el último día."
                  : ""}
              </p>
            </fieldset>

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
            <p className="-mt-3 text-xs text-slate-500">
              {hora && duracionNum
                ? "Con hora y duración, cada vez se agenda como evento en el Calendario."
                : "Sin hora, cada vez se crea como tarea de ese día."}
            </p>

            {/* ---------- De dónde cuelga ---------- */}
            <fieldset className="space-y-3">
              <legend className="mb-1 text-sm font-medium">De dónde cuelga</legend>
              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-slate-500">Dimensión</Label>
                <Select value={dimensionId} onValueChange={setDimensionId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNO}>Sin dimensión</SelectItem>
                    {dimensiones.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-slate-500">
                  Empuja un objetivo (opcional)
                </Label>
                <Select value={objectiveId} onValueChange={elegirObjetivo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNO}>Ninguno (es operación)</SelectItem>
                    {objetivos.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {objectiveId !== NINGUNO && metas.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-normal text-slate-500">¿Qué meta empuja?</Label>
                  <Select value={goalId} onValueChange={setGoalId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NINGUNO}>El objetivo en general</SelectItem>
                      {metas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {!tienePadre ? (
                <p className="text-xs text-amber-700">Elige una dimensión o un objetivo.</p>
              ) : null}
            </fieldset>

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
                Los cambios se aplican desde ahora; las tareas ya creadas no cambian.
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
                <Button
                  type="submit"
                  disabled={!nombre.trim() || !reglaCompleta || !tienePadre || busy}
                >
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
