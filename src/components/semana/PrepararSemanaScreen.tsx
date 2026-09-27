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
import { useMemo, useState } from "react";
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
import {
  dayLabel,
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

const STEPS = [
  "Cerrar la semana",
  "Mirar lo importante",
  "Detectar omisiones",
  "Revisar la carga",
  "Cerrar el ritual",
] as const;

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
          Paso {step + 1} de {STEPS.length} · {STEPS[step]}
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
        ) : step === 0 ? (
          <StepCerrar data={data} actions={actions} />
        ) : step === 1 ? (
          <StepImportante data={data} />
        ) : step === 2 ? (
          <StepOmisiones
            data={data}
            skipped={skipped}
            onAdd={(o) => setSheet({ open: true, mode: "create", defaults: o.createDefaults })}
            onSkip={skip}
            onUnskip={unskip}
          />
        ) : step === 3 ? (
          <StepCarga data={data} actions={actions} />
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

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat value={data.completedPrev.length} label="Completadas" />
        <Stat value={data.pendingPrev.length} label="Siguen pendientes" />
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
