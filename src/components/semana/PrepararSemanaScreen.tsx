/**
 * ========================================================
 * PrepararSemanaScreen — Ritual Semanal "Preparar mi semana"
 *
 * Flujo guiado de 5 pasos:
 *   1. Cerrar la semana anterior
 *   2. Mirar lo importante
 *   3. Detectar omisiones
 *   4. Revisar la carga
 *   5. Cerrar el ritual
 *
 * Integración (sin sistemas paralelos):
 * - Datos: `weeklyRitualService` (reutiliza fetchAreaTree + tasks).
 * - Crear/editar: el mismo `TaskDetailSheet` de toda la app.
 * - Mover de día / quitar fecha: `updateTask` (taskService), que
 *   además mueve la alarma si la tarea tenía una.
 * - Revisar: enlaza al Tablero con los mismos parámetros de URL.
 * - Refresco: `invalidateActivityGraph` (incluye ["weekly-ritual"]).
 *
 * Tono: sereno. Nunca "atrasado", "fallaste" ni "deberías".
 * ========================================================
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleDashed,
  Leaf,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskDetailSheet } from "@/components/TaskDetail";
import { updateTask } from "@/services/taskService";
import { invalidateActivityGraph } from "@/lib/queryInvalidation";
import { getReflectionsBetween } from "@/services/copilotService";
import {
  loadTimeDistribution,
  repeatInNextWeek,
  type TimeDistribution,
} from "@/services/weekPlanningService";
import { getCalendarEvents, type CalendarEvent } from "@/services/calendarService";
import { MonthView } from "@/components/calendar/MonthView";
import { Checkbox } from "@/components/ui/checkbox";
import { getProjectColor } from "@/lib/projectIdentity";
import {
  createRoutineOccurrences,
  existingOccurrenceKeys,
  fetchRoutineNodes,
  occurrencesForWeek,
  type RoutineOccurrence,
} from "@/services/routineService";
import {
  dayLabel,
  repeatKey,
  getSkippedKeys,
  loadWeeklyRitual,
  moveToDayIso,
  skipForWeek,
  unskipForWeek,
  type DayLoad,
  type Omission,
  type RitualTask,
  type TaskCreateDefaults,
  type WeeklyRitualData,
} from "@/services/weeklyRitualService";

type StepKey = "cerrar" | "repetir" | "importante" | "omisiones" | "carga" | "mes" | "cierre";

const STEP_LABEL: Record<StepKey, string> = {
  cerrar: "Cerrar la semana",
  repetir: "Repetir en la nueva semana",
  importante: "Mirar lo importante",
  omisiones: "Detectar omisiones",
  carga: "Revisar la carga",
  mes: "Mirar el mes",
  cierre: "Cerrar el ritual",
};

/**
 * Pasos del ritual. "Mirar el mes" aparece sólo en el primer ritual
 * de cada mes: cuando la semana que se prepara empieza entre el 1 y
 * el 7 del mes.
 */
function stepsFor(data: WeeklyRitualData | undefined): StepKey[] {
  const firstOfMonth = !!data && data.nextStart.getDate() <= 7;
  return [
    "cerrar",
    "repetir",
    "importante",
    "omisiones",
    "carga",
    ...(firstOfMonth ? (["mes"] as StepKey[]) : []),
    "cierre",
  ];
}

// ============================================================
// Utilidades de formato
// ============================================================

function fmtMinutes(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return isMidnight ? dayLabel(d) : `${dayLabel(d)} · ${hm}`;
}

function fmtRange(start: Date, endExclusive: Date): string {
  const last = new Date(endExclusive);
  last.setDate(last.getDate() - 1);
  return `${dayLabel(start)} al ${dayLabel(last)}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ============================================================
// Pantalla
// ============================================================

type SheetState =
  | { open: false }
  | { open: true; mode: "edit"; taskId: string }
  | { open: true; mode: "create"; defaults: TaskCreateDefaults };

export function PrepararSemanaScreen() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const [skipVersion, setSkipVersion] = useState(0);

  const { data, isLoading, isError } = useQuery<WeeklyRitualData>({
    queryKey: ["weekly-ritual"],
    queryFn: () => loadWeeklyRitual(),
  });

  const skipped = useMemo(
    () => (data ? getSkippedKeys(data.weekKey) : new Set<string>()),
    // skipVersion fuerza la relectura tras decidir "Esta semana no".
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.weekKey, skipVersion],
  );

  async function refresh() {
    await invalidateActivityGraph(queryClient);
  }

  async function moveTask(t: RitualTask, date: string) {
    try {
      await updateTask(t.id, { starts_at: moveToDayIso(t.startsAt, date) });
      toast.success(`"${t.title}" quedó para el ${dayLabel(new Date(date + "T00:00:00"))}.`);
      await refresh();
    } catch {
      toast.error("No se pudo mover la tarea. Inténtalo de nuevo.");
    }
  }

  async function clearDate(t: RitualTask) {
    try {
      await updateTask(t.id, { starts_at: null, ends_at: null });
      toast.success(`"${t.title}" quedó sin fecha.`);
      await refresh();
    } catch {
      toast.error("No se pudo actualizar la tarea.");
    }
  }

  function skip(o: Omission) {
    if (!data) return;
    skipForWeek(data.weekKey, o.key);
    setSkipVersion((v) => v + 1);
  }

  function unskip(o: Omission) {
    if (!data) return;
    unskipForWeek(data.weekKey, o.key);
    setSkipVersion((v) => v + 1);
  }

  const actions: TaskActions = {
    open: (id) => setSheet({ open: true, mode: "edit", taskId: id }),
    move: moveTask,
    clearDate,
  };

  const STEPS = stepsFor(data);
  const current: StepKey = STEPS[Math.min(step, STEPS.length - 1)];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 md:py-8 pb-32 md:pb-16">
      {/* Encabezado */}
      <div>
        <Link
          to="/ajustes"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Ajustes
        </Link>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          Preparar mi semana
        </h1>
        {data ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Semana del {fmtRange(data.nextStart, data.nextEnd)}
          </p>
        ) : null}
      </div>

      {/* Avance */}
      <div className="mt-6">
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-[color:var(--brand-violet)]" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Paso {step + 1} de {STEPS.length} · {STEP_LABEL[current]}
        </p>
      </div>

      {/* Contenido */}
      <div className="mt-6 min-h-[40vh]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Reuniendo tu semana con calma…</p>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">
            No pudimos reunir la información de tu semana. Inténtalo de nuevo en un momento.
          </p>
        ) : current === "cerrar" ? (
          <StepCerrar data={data} actions={actions} />
        ) : current === "repetir" ? (
          <StepRepetir data={data} onDone={refresh} />
        ) : current === "importante" ? (
          <StepImportante data={data} />
        ) : current === "omisiones" ? (
          <StepOmisiones
            data={data}
            skipped={skipped}
            onAdd={(o) => setSheet({ open: true, mode: "create", defaults: o.createDefaults })}
            onSkip={skip}
            onUnskip={unskip}
          />
        ) : current === "carga" ? (
          <StepCarga data={data} actions={actions} />
        ) : current === "mes" ? (
          <StepMes data={data} onOpen={actions.open} />
        ) : (
          <StepCierre data={data} skipped={skipped} />
        )}
      </div>

      {/* Navegación */}
      <div className="mt-10 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!data}>
            Siguiente
          </Button>
        ) : (
          <Button asChild>
            <Link to="/foco">Listo</Link>
          </Button>
        )}
      </div>

      {/* Formulario de tarea reutilizado */}
      <TaskDetailSheet
        open={sheet.open}
        onOpenChange={(open) => {
          if (!open) {
            setSheet({ open: false });
            void refresh();
          }
        }}
        mode={sheet.open ? sheet.mode : "create"}
        taskId={sheet.open && sheet.mode === "edit" ? sheet.taskId : undefined}
        createDefaults={sheet.open && sheet.mode === "create" ? sheet.defaults : undefined}
      />
    </div>
  );
}

// ============================================================
// Piezas compartidas
// ============================================================

interface TaskActions {
  open: (id: string) => void;
  move: (t: RitualTask, date: string) => void;
  clearDate: (t: RitualTask) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border bg-card px-3 py-4 text-center">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const shown = all ? items : items.slice(0, 8);
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="rounded-full border bg-background px-3 py-1 text-xs text-foreground/80"
        >
          {name}
        </span>
      ))}
      {items.length > 8 && !all ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-full px-3 py-1 text-xs text-indigo-600 hover:text-indigo-700"
        >
          y {items.length - 8} más
        </button>
      ) : null}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-[color:var(--brand-violet)]"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Días de la nueva semana para el menú "Pasar a…". */
function nextWeekDays(data: WeeklyRitualData): { date: string; label: string }[] {
  return data.days.map((d) => ({ date: d.date, label: d.label }));
}

function TaskRow({
  task,
  data,
  actions,
  allowMove = true,
}: {
  task: RitualTask;
  data: WeeklyRitualData;
  actions: TaskActions;
  allowMove?: boolean;
}) {
  const meta = [task.linkLabel ?? task.areaName, fmtWhen(task.startsAt)]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <button
        type="button"
        onClick={() => actions.open(task.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium text-foreground">
          {task.priority === "high" ? (
            <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-[color:var(--brand-violet)]" />
          ) : null}
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </button>
      {allowMove && task.activityType === "task" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              Decidir
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Pasar a la nueva semana
            </DropdownMenuLabel>
            {nextWeekDays(data).map((d) => (
              <DropdownMenuItem key={d.date} onSelect={() => actions.move(task, d.date)}>
                {d.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {task.startsAt ? (
              <DropdownMenuItem onSelect={() => actions.clearDate(task)}>
                Dejar sin fecha
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => actions.open(task.id)}>Abrir tarea</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

function TaskList({
  tasks,
  data,
  actions,
  limit = 6,
  allowMove = true,
}: {
  tasks: RitualTask[];
  data: WeeklyRitualData;
  actions: TaskActions;
  limit?: number;
  allowMove?: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? tasks : tasks.slice(0, limit);
  return (
    <>
      <ul className="divide-y">
        {shown.map((t) => (
          <TaskRow key={t.id} task={t} data={data} actions={actions} allowMove={allowMove} />
        ))}
      </ul>
      {tasks.length > limit && !all ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-2 text-xs text-indigo-600 hover:text-indigo-700"
        >
          Ver {tasks.length - limit} más
        </button>
      ) : null}
    </>
  );
}

// ============================================================
// Paso 1 — Cerrar la semana anterior
// ============================================================

function StepCerrar({ data, actions }: { data: WeeklyRitualData; actions: TaskActions }) {
  const toDecide = [...data.pendingPrev, ...data.overdueOlder];
  return (
    <div className="space-y-8">
      <p className="text-[15px] leading-relaxed text-foreground/80">
        Antes de mirar hacia adelante, un vistazo tranquilo a la semana del{" "}
        {fmtRange(data.prevStart, data.prevEnd)}.
      </p>

      <DistribucionTiempo from={data.prevStart} to={data.prevEnd} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Stat value={data.completedPrev.length} label="Completadas" />
        <Stat value={data.pendingPrev.length} label="Siguen pendientes" />
        <Stat value={data.notDonePrev.length} label="No hechas" />
        <Stat value={data.overdueOlder.length} label="De semanas anteriores" />
      </div>

      <section className="space-y-3">
        <SectionTitle>Proyectos con movimiento</SectionTitle>
        <Chips
          items={data.projectsMoved.map((p) => p.name)}
          empty="Esta semana ningún proyecto tuvo tareas completadas ni eventos."
        />
      </section>

      <section className="space-y-3">
        <SectionTitle>Proyectos sin movimiento esta semana</SectionTitle>
        <Chips
          items={data.projectsStill.map((p) => p.name)}
          empty="Todos tus proyectos activos tuvieron movimiento."
        />
      </section>

      <ReflexionesSemana from={data.prevStart} to={data.prevEnd} />

      {data.habits.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Tus hábitos esta semana</SectionTitle>
          <Card>
            <ul className="space-y-3">
              {data.habits.map((h) => (
                <li key={h.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-foreground">{h.name}</span>
                    <span className="shrink-0 text-xs font-medium text-foreground/80">
                      {h.weekDone} de {h.weekExpected} {h.weekExpected === 1 ? "día" : "días"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Semanas anteriores:{" "}
                    {h.history.map((w) => `${w.done}/${w.expected}`).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Cuenta los días en que marcaste el hábito en el Tablero o completaste una tarea
              vinculada a él.
            </p>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>Esto sigue pendiente</SectionTitle>
        {toDecide.length === 0 ? (
          <Card>
            <p className="flex items-center gap-2 text-sm text-foreground/80">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              No quedan pendientes con fecha pasada.
            </p>
          </Card>
        ) : (
          <Card>
            <p className="mb-1 text-xs text-muted-foreground">
              Decide con calma: pásalo a un día de la nueva semana, déjalo sin fecha o ábrelo.
            </p>
            <TaskList tasks={toDecide} data={data} actions={actions} limit={8} />
          </Card>
        )}
      </section>
    </div>
  );
}

/** Lo que el Copiloto observó en la semana y lo que respondiste. */
function ReflexionesSemana({ from, to }: { from: Date; to: Date }) {
  const items = getReflectionsBetween(from, to);
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionTitle>Lo que observaste esta semana</SectionTitle>
      <Card>
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id}>
              <p className="text-sm text-foreground/85">{r.evidence}</p>
              {r.answer ? (
                <p className="mt-1.5 border-l-2 border-[color:var(--brand-violet)]/40 pl-3 text-sm italic text-muted-foreground">
                  “{r.answer}”
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{r.question}</p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

// ============================================================
// Cómo se distribuyó tu tiempo (dentro de "Cerrar la semana")
// ============================================================

function DistribucionTiempo({ from, to }: { from: Date; to: Date }) {
  const { data, isLoading, isError } = useQuery<TimeDistribution>({
    queryKey: ["weekly-ritual", "time", from.toISOString()],
    queryFn: () => loadTimeDistribution(from, to),
  });
  const [verTodo, setVerTodo] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Sumando tu tiempo…</p>;
  if (isError || !data) return null;

  if (data.totalMin === 0) {
    return (
      <section className="space-y-3">
        <SectionTitle>Cómo se distribuyó tu tiempo</SectionTitle>
        <Card>
          <p className="text-sm text-muted-foreground">
            Esta semana no hay tiempo registrado. Cuando tus tareas tengan duración y tus eventos
            horario, aquí verás en qué se fue la semana.
          </p>
        </Card>
      </section>
    );
  }

  const max = Math.max(...data.areas.map((a) => a.min), 1);
  const proyectos = verTodo ? data.projects : data.projects.slice(0, 5);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>Cómo se distribuyó tu tiempo</SectionTitle>
        <span className="text-sm font-semibold text-foreground">{fmtMinutes(data.totalMin)}</span>
      </div>

      <Card>
        <ul className="space-y-4">
          {data.areas.map((a) => {
            const color = getProjectColor(a.color);
            return (
              <li key={a.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} aria-hidden />
                    <span className="truncate">{a.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {fmtMinutes(a.min)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${color.dot}`}
                    style={{ width: `${Math.max(4, Math.round((a.min / max) * 100))}%` }}
                  />
                </div>
                {a.dimensions.some((d) => d.name) ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {a.dimensions
                      .map((d) => `${d.name ?? "Sin dimensión"} ${fmtMinutes(d.min)}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {data.projects.length > 0 ? (
        <Card>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Por proyecto</p>
          <ul className="space-y-1.5">
            {proyectos.map((p) => (
              <li
                key={`${p.name}-${p.detail}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0 truncate text-sm text-foreground">
                  {p.name}
                  <span className="text-muted-foreground"> · {p.detail}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-foreground/80">
                  {fmtMinutes(p.min)}
                </span>
              </li>
            ))}
          </ul>
          {data.projects.length > 5 && !verTodo ? (
            <button
              type="button"
              onClick={() => setVerTodo(true)}
              className="mt-2 text-xs text-indigo-600 hover:text-indigo-700"
            >
              Ver {data.projects.length - 5} más
            </button>
          ) : null}
        </Card>
      ) : null}

      {data.tags.length > 0 ? (
        <Card>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Por etiqueta</p>
          <div className="flex flex-wrap gap-2">
            {data.tags.map((t) => (
              <span
                key={t.name}
                className="rounded-full border bg-background px-3 py-1 text-xs text-foreground/80"
              >
                {t.name} · {fmtMinutes(t.min)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Una actividad con varias etiquetas suma su tiempo completo en cada una.
          </p>
        </Card>
      ) : null}

      {data.withoutTime > 0 ? (
        <p className="text-xs text-muted-foreground">
          {data.withoutTime === 1
            ? "1 actividad realizada no tiene tiempo registrado y no se suma."
            : `${data.withoutTime} actividades realizadas no tienen tiempo registrado y no se suman.`}
        </p>
      ) : null}
    </section>
  );
}

// ============================================================
// Repetir en la nueva semana
// ============================================================

function StepRepetir({ data, onDone }: { data: WeeklyRitualData; onDone: () => Promise<void> }) {
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set());
  const [copiando, setCopiando] = useState(false);
  const [fallas, setFallas] = useState<{ title: string; reason: string }[]>([]);

  const yaEsta = useMemo(() => new Set(data.nextWeekKeys), [data.nextWeekKeys]);
  const estaEnNueva = (t: RitualTask) => yaEsta.has(repeatKey(t.title, t.startsAt));

  // ---- Rutinas: sus días de la nueva semana, ya marcados ----
  const { data: rutinas = [] } = useQuery({
    queryKey: ["weekly-ritual", "routines"],
    queryFn: fetchRoutineNodes,
  });
  const { data: existentes } = useQuery({
    queryKey: ["weekly-ritual", "routine-keys", data.nextStart.toISOString()],
    queryFn: () => existingOccurrenceKeys(data.nextStart, data.nextEnd),
  });
  const ocurrencias = useMemo(
    () => rutinas.flatMap((r) => occurrencesForWeek(r, data.nextStart)),
    [rutinas, data.nextStart],
  );
  const [rutElegidas, setRutElegidas] = useState<Set<string>>(() => new Set());
  const [rutIniciadas, setRutIniciadas] = useState(false);
  useEffect(() => {
    if (rutIniciadas || !existentes) return;
    setRutElegidas(new Set(ocurrencias.filter((o) => !existentes.has(o.key)).map((o) => o.key)));
    setRutIniciadas(true);
  }, [existentes, ocurrencias, rutIniciadas]);
  const rutinaYaEsta = (o: RoutineOccurrence) => !!existentes?.has(o.key);
  const routineTaskIds = useMemo(() => new Set(rutinas.flatMap((r) => r.taskIds)), [rutinas]);

  function toggleRut(key: string) {
    setRutElegidas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Las tareas de Rutinas no se repiten como copia: se generan desde la Rutina.
  const candidatos = useMemo(
    () => data.repeatCandidates.filter((t) => !routineTaskIds.has(t.id)),
    [data.repeatCandidates, routineTaskIds],
  );

  // Grupos por Área · Dimensión, en orden de aparición.
  const grupos = useMemo(() => {
    const map = new Map<string, RitualTask[]>();
    for (const t of candidatos) {
      const k = `${t.areaName} · ${t.dimensionName ?? "Sin dimensión"}`;
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return [...map.entries()];
  }, [candidatos]);

  function toggle(id: string) {
    setElegidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGrupo(items: RitualTask[]) {
    const disponibles = items.filter((t) => !estaEnNueva(t)).map((t) => t.id);
    setElegidas((prev) => {
      const next = new Set(prev);
      const todas = disponibles.every((id) => next.has(id));
      for (const id of disponibles) {
        if (todas) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const totalElegidas = elegidas.size + rutElegidas.size;

  async function copiar() {
    setCopiando(true);
    setFallas([]);
    try {
      const rut = await createRoutineOccurrences(
        rutinas,
        ocurrencias.filter((o) => rutElegidas.has(o.key)),
      );
      const res =
        elegidas.size > 0 ? await repeatInNextWeek([...elegidas]) : { copied: 0, failed: [] };
      const total = rut.created + res.copied;
      if (total > 0) {
        toast.success(
          total === 1
            ? "1 actividad quedó en la nueva semana."
            : `${total} actividades quedaron en la nueva semana.`,
        );
      }
      setFallas([...rut.failed, ...res.failed]);
      setElegidas(new Set());
      setRutElegidas(new Set());
      await onDone();
    } catch {
      toast.error("No se pudieron copiar las actividades. Inténtalo de nuevo.");
    } finally {
      setCopiando(false);
    }
  }

  if (candidatos.length === 0 && ocurrencias.length === 0) {
    return (
      <div className="space-y-6">
        <p className="text-[15px] leading-relaxed text-foreground/80">
          La semana que termina no tiene actividades para repetir.
        </p>
      </div>
    );
  }

  // Rutinas agrupadas por nombre (una fila por día).
  const rutinasConDias = rutinas
    .map((r) => ({ r, items: ocurrencias.filter((o) => o.routineId === r.id) }))
    .filter((x) => x.items.length > 0);

  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-foreground/80">
        Elige qué se repite en la nueva semana. Tus Rutinas vienen marcadas; lo demás se copia al
        mismo día y hora, con su duración, etiquetas y recordatorio. Lo que no marques, no pasa.
      </p>

      {rutinasConDias.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>Rutinas</SectionTitle>
          <Card className="!p-0">
            <ul className="divide-y">
              {rutinasConDias.flatMap(({ r, items }) =>
                items.map((o) => {
                  const ya = rutinaYaEsta(o);
                  const id = `rut-${o.key}`;
                  const d = new Date(o.startsAt);
                  return (
                    <li key={o.key}>
                      <label
                        htmlFor={id}
                        className={`flex min-h-[52px] items-start gap-3 px-4 py-3 ${
                          ya ? "opacity-60" : "cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          id={id}
                          className="mt-0.5 h-5 w-5"
                          checked={ya || rutElegidas.has(o.key)}
                          disabled={ya || copiando}
                          onCheckedChange={() => toggleRut(o.key)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            ↻ {r.nombre}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {dayLabel(d)}
                            {r.hora ? ` · ${r.hora}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                          {ya ? "Ya está" : o.duracionMin ? fmtMinutes(o.duracionMin) : ""}
                        </span>
                      </label>
                    </li>
                  );
                }),
              )}
            </ul>
          </Card>
        </section>
      ) : null}

      {grupos.map(([nombre, items]) => {
        const disponibles = items.filter((t) => !estaEnNueva(t));
        const todas = disponibles.length > 0 && disponibles.every((t) => elegidas.has(t.id));
        return (
          <section key={nombre} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>{nombre}</SectionTitle>
              {disponibles.length > 1 ? (
                <button
                  type="button"
                  onClick={() => toggleGrupo(items)}
                  className="min-h-[36px] shrink-0 px-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {todas ? "Quitar todas" : "Marcar todas"}
                </button>
              ) : null}
            </div>
            <Card className="!p-0">
              <ul className="divide-y">
                {items.map((t) => {
                  const ya = estaEnNueva(t);
                  const id = `rep-${t.id}`;
                  const dur = itemMinutesLabel(t);
                  return (
                    <li key={t.id}>
                      <label
                        htmlFor={id}
                        className={`flex min-h-[52px] items-start gap-3 px-4 py-3 ${
                          ya ? "opacity-60" : "cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          id={id}
                          className="mt-0.5 h-5 w-5"
                          checked={ya || elegidas.has(t.id)}
                          disabled={ya || copiando}
                          onCheckedChange={() => toggle(t.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {t.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {[fmtWhen(t.startsAt), t.linkLabel].filter(Boolean).join(" · ")}
                            {t.status === "not_done"
                              ? t.activityType === "event"
                                ? " · No fui"
                                : " · No la hice"
                              : ""}
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                          {ya ? "Ya está" : dur}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}

      {fallas.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <p className="text-sm font-medium text-foreground">No se copiaron:</p>
          <ul className="mt-1 space-y-1">
            {fallas.map((f, i) => (
              <li key={i} className="text-xs text-foreground/80">
                {f.title}: {f.reason}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="sticky bottom-24 md:bottom-4">
        <Button
          className="w-full min-h-[48px] shadow-lg"
          disabled={totalElegidas === 0 || copiando}
          onClick={() => void copiar()}
        >
          {copiando
            ? "Copiando…"
            : totalElegidas === 0
              ? "Marca lo que se repite"
              : `Agregar ${plural(totalElegidas, "actividad", "actividades")} a la nueva semana`}
        </Button>
      </div>
    </div>
  );
}

function itemMinutesLabel(t: RitualTask): string {
  if (t.activityType === "event" && t.startsAt && t.endsAt) {
    const m = (new Date(t.endsAt).getTime() - new Date(t.startsAt).getTime()) / 60000;
    return m > 0 ? fmtMinutes(Math.round(m)) : "";
  }
  return t.estimatedMin ? fmtMinutes(t.estimatedMin) : "";
}

// ============================================================
// Mirar el mes (primer ritual de cada mes)
// ============================================================

function StepMes({ data, onOpen }: { data: WeeklyRitualData; onOpen: (id: string) => void }) {
  const anchor = data.nextStart;
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59);
  // Rango de semanas completas, igual que la vista mensual del Calendario.
  const desde = new Date(from);
  desde.setDate(desde.getDate() - ((desde.getDay() + 6) % 7));
  const hasta = new Date(to);
  hasta.setDate(hasta.getDate() + ((7 - hasta.getDay()) % 7));

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar", "ritual-mes", desde.toISOString()],
    queryFn: () => getCalendarEvents(desde, hasta),
  });

  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-foreground/80">
        Es el primer ritual del mes. Antes de cerrar, mira cómo vienen las próximas semanas: los
        días cargados, los vacíos y si tus hábitos tienen espacio. Toca un día para ver su detalle.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando el mes…</p>
      ) : (
        <MonthView
          anchor={anchor}
          events={events}
          onSelectEvent={(e) => {
            if (e.source === "calmapp") onOpen(e.id);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Paso 2 — Mirar lo importante
// ============================================================

function StepImportante({ data }: { data: WeeklyRitualData }) {
  return (
    <div className="space-y-8">
      <p className="text-[15px] leading-relaxed text-foreground/80">
        Solo para ubicarte. Aquí no hay nada que hacer, solo mirar.
      </p>

      <section className="space-y-3">
        <SectionTitle>Objetivos y metas</SectionTitle>
        {data.objectives.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes objetivos activos.</p>
        ) : (
          <div className="space-y-2">
            {data.objectives.map((o) => (
              <Card key={o.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{o.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(o.progressPct)}%
                  </span>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">{o.areaName}</p>
                <ProgressBar pct={o.progressPct} />
                {o.goals.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {o.goals.map((g) => (
                      <li
                        key={g.id}
                        className="flex justify-between gap-3 text-xs text-foreground/75"
                      >
                        <span className="truncate">{g.name}</span>
                        <span className="text-muted-foreground">{Math.round(g.progressPct)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Proyectos activos</SectionTitle>
        {data.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes proyectos activos.</p>
        ) : (
          <Card>
            <ul className="space-y-3">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(p.progressPct)}%
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar pct={p.progressPct} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Hábitos</SectionTitle>
        {data.habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes hábitos activos.</p>
        ) : (
          <Card>
            <ul className="space-y-2">
              {data.habits.map((h) => (
                <li key={h.id} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-foreground">{h.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {h.compliancePct}% este mes
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Compromisos ya agendados</SectionTitle>
        {data.eventsNext.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes eventos agendados para esta semana.
          </p>
        ) : (
          <Card>
            <ul className="space-y-2">
              {data.eventsNext.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtWhen(e.startsAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Paso 3 — Detectar omisiones
// ============================================================

function StepOmisiones({
  data,
  skipped,
  onAdd,
  onSkip,
  onUnskip,
}: {
  data: WeeklyRitualData;
  skipped: Set<string>;
  onAdd: (o: Omission) => void;
  onSkip: (o: Omission) => void;
  onUnskip: (o: Omission) => void;
}) {
  const active = data.omissions.filter((o) => !skipped.has(o.key));
  const resting = data.omissions.filter((o) => skipped.has(o.key));

  return (
    <div className="space-y-8">
      <p className="text-[15px] leading-relaxed text-foreground/80">
        Lo que tiene tareas importantes pendientes, pero nada planificado para esta semana. No hay
        que llenarlo todo: solo decidir con consciencia.
      </p>

      {active.length === 0 ? (
        <Card>
          <p className="flex items-center gap-2 text-sm text-foreground/80">
            <Leaf className="h-4 w-4 text-emerald-600" />
            Todo lo importante tiene espacio esta semana.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map((o) => (
            <Card key={o.key}>
              <p className="text-base font-medium text-foreground">{o.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {o.kind === "project" ? "Proyecto activo" : "Meta activa"} · {o.areaName} · 0
                acciones esta semana
              </p>
              <p className="mt-3 text-sm leading-relaxed text-foreground/80">
                {o.kind === "project" ? "Este proyecto sigue activo" : "Esta meta sigue activa"} y
                tiene {plural(o.highPendingCount, "tarea importante", "tareas importantes")}{" "}
                pendiente{o.highPendingCount === 1 ? "" : "s"}, pero ninguna acción planificada esta
                semana.
              </p>
              {o.vision ? (
                <p className="mt-3 border-l-2 border-[color:var(--brand-violet)]/40 pl-3 text-sm italic leading-relaxed text-muted-foreground">
                  “{o.vision}”
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onAdd(o)}>
                  <Plus className="h-4 w-4" />
                  Agregar acción
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSkip(o)}>
                  Esta semana no
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/tablero" search={o.tablero}>
                    {o.kind === "project" ? "Revisar proyecto" : "Revisar meta"}
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {resting.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Decidiste darles espacio otra semana</SectionTitle>
          <Card>
            <ul className="space-y-2">
              {resting.map((o) => (
                <li key={o.key} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-foreground/80">{o.name}</span>
                  <button
                    type="button"
                    onClick={() => onUnskip(o)}
                    className="shrink-0 text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    Deshacer
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

// ============================================================
// Paso 4 — Revisar la carga
// ============================================================

function DayRow({
  day,
  data,
  actions,
}: {
  day: DayLoad;
  data: WeeklyRitualData;
  actions: TaskActions;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={day.isEmpty}
        className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-default"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{day.label}</p>
          <p className="text-xs text-muted-foreground">
            {day.isEmpty
              ? "Día libre"
              : `${plural(day.items.length, "actividad", "actividades")} · ${fmtMinutes(day.totalMin)} estimados`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {day.highCount >= 3 ? (
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-foreground/70">
              {day.highCount} importantes
            </span>
          ) : null}
          {day.isHeavy ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Día cargado
            </span>
          ) : null}
          {!day.isEmpty ? (
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          ) : null}
        </div>
      </button>
      {open ? (
        <div className="mt-2 rounded-xl bg-muted/40 px-3">
          <TaskList tasks={day.items} data={data} actions={actions} limit={20} />
        </div>
      ) : null}
    </li>
  );
}

function StepCarga({ data, actions }: { data: WeeklyRitualData; actions: TaskActions }) {
  const heavy = data.days.filter((d) => d.isHeavy);
  const totalMin = data.days.reduce((acc, d) => acc + d.totalMin, 0);

  return (
    <div className="space-y-8">
      <p className="text-[15px] leading-relaxed text-foreground/80">
        Así quedó repartida tu semana: {fmtMinutes(totalMin)} estimados en total.
        {heavy.length > 0
          ? ` ${heavy.length === 1 ? "Hay un día" : `Hay ${heavy.length} días`} con bastante carga; quizás valga la pena mover algo.`
          : " La carga se ve repartida."}
      </p>

      <Card>
        <ul className="divide-y">
          {data.days.map((d) => (
            <DayRow key={d.date} day={d} data={data} actions={actions} />
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          El tiempo se calcula con la duración estimada de cada tarea y el horario de cada evento.
        </p>
      </Card>

      {data.conflicts.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Horarios que se cruzan</SectionTitle>
          <Card>
            <ul className="space-y-3">
              {data.conflicts.map((c) => (
                <li key={`${c.a.id}-${c.b.id}`} className="text-sm text-foreground/80">
                  <button
                    type="button"
                    onClick={() => actions.open(c.a.id)}
                    className="font-medium hover:underline"
                  >
                    {c.a.title}
                  </button>{" "}
                  y{" "}
                  <button
                    type="button"
                    onClick={() => actions.open(c.b.id)}
                    className="font-medium hover:underline"
                  >
                    {c.b.title}
                  </button>
                  <p className="text-xs text-muted-foreground">{fmtWhen(c.a.startsAt)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>Pendientes sin fecha</SectionTitle>
        {data.undated.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes pendientes sin fecha.</p>
        ) : (
          <Card>
            <p className="mb-1 text-xs text-muted-foreground">
              {plural(data.undated.length, "tarea espera", "tareas esperan")} un lugar. Si alguna es
              para esta semana, puedes ubicarla aquí.
            </p>
            <TaskList tasks={data.undated} data={data} actions={actions} limit={5} />
          </Card>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Paso 5 — Cerrar el ritual
// ============================================================

function StepCierre({ data, skipped }: { data: WeeklyRitualData; skipped: Set<string> }) {
  const undecided = data.omissions.filter((o) => !skipped.has(o.key));

  return (
    <div className="space-y-10 text-center">
      <div className="space-y-3 pt-4">
        <CircleDashed className="mx-auto h-8 w-8 text-[color:var(--brand-violet)]" />
        <p className="text-2xl font-medium tracking-tight text-foreground">
          Tu semana está preparada.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-left">
        <Stat value={data.projectsWithActions.length} label="Proyectos con acciones" />
        <Stat value={data.goalsWithActions.length} label="Metas con acciones" />
      </div>

      {data.mainTasks.length > 0 ? (
        <section className="space-y-3 text-left">
          <SectionTitle>Lo principal de la semana</SectionTitle>
          <Card>
            <ul className="space-y-2">
              {data.mainTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <p className="truncate text-sm text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[t.linkLabel, fmtWhen(t.startsAt)].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {undecided.length > 0 ? (
        <section className="space-y-3 text-left">
          <SectionTitle>Todavía por decidir</SectionTitle>
          <Card>
            <ul className="space-y-1">
              {undecided.map((o) => (
                <li key={o.key} className="text-sm text-foreground/80">
                  {o.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Puedes volver al paso 3 cuando quieras.
            </p>
          </Card>
        </section>
      ) : null}

      <p className="mx-auto max-w-md text-[15px] italic leading-relaxed text-foreground/75">
        No necesitas recordarlo todo. Ya lo pensaste y CalmApp te ayudará a mantenerlo visible.
      </p>
    </div>
  );
}
