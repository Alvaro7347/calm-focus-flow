/**
 * ========================================================
 * FinanzasScreen — Finanzas del hogar (/finanzas)
 *
 * - La primera vez: bienvenida en 3 pasos (moneda, fuentes de ingreso,
 *   cargos fijos; los dos últimos se pueden saltar).
 * - Después: período Semana · Mes · Año con flechas, "Te quedan $X"
 *   (entró − salió) con lo "por recibir" (sólo en Mes), dona de gastos
 *   por categoría, ingresos por fuente, deuda de la tarjeta, cargos fijos
 *   y la lista de movimientos (tocar uno lo edita). El "+" abre la hoja
 *   para registrar.
 * - Al entrar se anotan solos los cargos fijos que ya se cobraron.
 * - Pestañas Resumen · Flujo: el Flujo planifica los próximos meses
 *   (ver FlujoFinanzas).
 * ========================================================
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Settings, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clp,
  completeOnboarding,
  fechaCorta,
  fetchCardDebt,
  fetchCategories,
  fetchIncomeSources,
  fetchMovements,
  fetchRecurringCharges,
  fetchSettings,
  rangoPeriodo,
  resumir,
  syncRecurringCharges,
  tituloPeriodo,
  type MovementKind,
  type MovementRow,
  type Periodo,
} from "@/services/financeService";
import { MovimientoSheet } from "./MovimientoSheet";
import { AjustesFinanzasSheet, CargosEditor, FuentesEditor } from "./AjustesFinanzasSheet";
import { FlujoFinanzas } from "./FlujoFinanzas";

export function FinanzasScreen() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["finanzas", "settings"], queryFn: fetchSettings });
  const [bienvenida, setBienvenida] = useState<number | null>(null);

  // Primera vez: mostrar la bienvenida (y mantenerla hasta terminar).
  useEffect(() => {
    if (settingsQ.isSuccess && !settingsQ.data?.onboarded_at && bienvenida === null)
      setBienvenida(0);
  }, [settingsQ.isSuccess, settingsQ.data, bienvenida]);

  if (settingsQ.isLoading) {
    return <p className="px-6 py-10 text-sm text-slate-500">Cargando tus finanzas…</p>;
  }
  if (settingsQ.isError) {
    return (
      <p className="px-6 py-10 text-sm text-rose-600">
        No se pudo abrir Finanzas. Si es la primera vez, puede faltar aplicar la migración.
      </p>
    );
  }
  if (bienvenida !== null) {
    return (
      <Bienvenida
        paso={bienvenida}
        setPaso={setBienvenida}
        onTerminar={async () => {
          setBienvenida(null);
          await qc.invalidateQueries({ queryKey: ["finanzas"] });
        }}
      />
    );
  }
  return <Panel />;
}

// ============================================================
// Bienvenida
// ============================================================

function Bienvenida({
  paso,
  setPaso,
  onTerminar,
}: {
  paso: number;
  setPaso: (n: number) => void;
  onTerminar: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const [empezando, setEmpezando] = useState(false);
  const { data: fuentes = [] } = useQuery({
    queryKey: ["finanzas", "fuentes"],
    queryFn: fetchIncomeSources,
    enabled: paso >= 1,
  });
  const { data: cargos = [] } = useQuery({
    queryKey: ["finanzas", "cargos"],
    queryFn: fetchRecurringCharges,
    enabled: paso >= 2,
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["finanzas", "categorias"],
    queryFn: fetchCategories,
    enabled: paso >= 2,
  });

  return (
    <div className="mx-auto max-w-lg px-6 py-8 pb-32 md:pb-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
        Finanzas del hogar · Paso {paso + 1} de 3
      </p>

      {paso === 0 ? (
        <div className="mt-3 space-y-5">
          <h1 className="text-2xl font-bold text-slate-900">Ordena lo que entra y lo que sale</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Un gestor simple para la plata del hogar: tus ingresos, tus cargos fijos y los gastos
            del día a día, en un solo lugar.
          </p>
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">Moneda</p>
            <p className="mt-1 text-lg font-bold">Peso chileno (CLP)</p>
          </div>
          <Button
            className="min-h-[52px] w-full rounded-2xl text-base"
            disabled={empezando}
            onClick={async () => {
              setEmpezando(true);
              try {
                await completeOnboarding("CLP");
                await qc.invalidateQueries({ queryKey: ["finanzas"] });
                setPaso(1);
              } finally {
                setEmpezando(false);
              }
            }}
          >
            {empezando ? "Preparando…" : "Empezar"}
          </Button>
        </div>
      ) : null}

      {paso === 1 ? (
        <div className="mt-3 space-y-5">
          <h1 className="text-2xl font-bold text-slate-900">¿De dónde entra la plata?</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Agrega tus fuentes de ingreso: por ejemplo UNAB, UTEM o Clases de ukelele. Si sabes
            cuánto esperas al mes, ponlo; si varía, déjalo vacío.
          </p>
          <FuentesEditor fuentes={fuentes} />
          <div className="flex gap-2">
            <Button variant="ghost" className="min-h-[48px]" onClick={() => setPaso(2)}>
              Saltar
            </Button>
            <Button className="min-h-[48px] flex-1 rounded-2xl" onClick={() => setPaso(2)}>
              Seguir
            </Button>
          </div>
        </div>
      ) : null}

      {paso === 2 ? (
        <div className="mt-3 space-y-5">
          <h1 className="text-2xl font-bold text-slate-900">Tus cargos fijos</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Las suscripciones que se cobran solas cada mes (ChatGPT, Canva, CapCut…). Se anotarán
            automáticamente en su día.
          </p>
          <CargosEditor cargos={cargos} categorias={categorias} />
          <div className="flex gap-2">
            <Button variant="ghost" className="min-h-[48px]" onClick={() => void onTerminar()}>
              Saltar
            </Button>
            <Button className="min-h-[48px] flex-1 rounded-2xl" onClick={() => void onTerminar()}>
              Listo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// Panel principal
// ============================================================

function Panel() {
  const [vista, setVista] = useState<"resumen" | "flujo">("resumen");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [offset, setOffset] = useState(0);
  const [hoja, setHoja] = useState<{ open: boolean; mov: MovementRow | null; tipo: MovementKind }>({
    open: false,
    mov: null,
    tipo: "expense",
  });
  const [ajustes, setAjustes] = useState(false);
  const { desde, hasta } = rangoPeriodo(periodo, offset);

  // Al entrar: anotar los cargos fijos que ya se cobraron.
  const sync = useQuery({
    queryKey: ["finanzas", "sync"],
    queryFn: () => syncRecurringCharges(),
    staleTime: 5 * 60_000,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["finanzas", "categorias"],
    queryFn: fetchCategories,
  });
  const { data: fuentes = [] } = useQuery({
    queryKey: ["finanzas", "fuentes"],
    queryFn: fetchIncomeSources,
  });
  const { data: cargos = [] } = useQuery({
    queryKey: ["finanzas", "cargos"],
    queryFn: fetchRecurringCharges,
  });
  const { data: deuda = 0 } = useQuery({
    queryKey: ["finanzas", "deuda", sync.dataUpdatedAt],
    queryFn: fetchCardDebt,
  });
  const movsQ = useQuery({
    queryKey: ["finanzas", "movs", periodo, offset, sync.dataUpdatedAt],
    queryFn: () => fetchMovements(desde, hasta),
  });
  const movs = useMemo(() => movsQ.data ?? [], [movsQ.data]);
  const r = useMemo(
    () => resumir(movs, categorias, fuentes, periodo),
    [movs, categorias, fuentes, periodo],
  );

  const catById = new Map(categorias.map((c) => [c.id, c]));
  const fuenteById = new Map(fuentes.map((f) => [f.id, f]));
  const queda = r.entro - r.salio;
  const totalCargos = cargos.reduce((n, c) => n + c.amount, 0);

  return (
    <div
      className={`mx-auto px-4 py-6 pb-36 md:px-8 md:pb-10 ${vista === "flujo" ? "max-w-6xl" : "max-w-3xl"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Wallet className="h-6 w-6 text-indigo-600" aria-hidden />
            Finanzas · Hogar
          </h1>
          <p className="mt-1 text-sm text-slate-500">Ordena lo que entra y lo que sale.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="hidden md:inline-flex"
            onClick={() => setHoja({ open: true, mov: null, tipo: "expense" })}
          >
            <Plus className="h-4 w-4" /> Registrar
          </Button>
          <button
            type="button"
            onClick={() => setAjustes(true)}
            aria-label="Ajustes de Finanzas"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Resumen · Flujo */}
      <div role="tablist" aria-label="Vista" className="mt-4 flex gap-5 border-b border-slate-200">
        {(
          [
            ["resumen", "Resumen"],
            ["flujo", "Flujo"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={vista === id}
            onClick={() => setVista(id)}
            className={`-mb-px min-h-[44px] border-b-2 px-1 text-sm ${
              vista === id
                ? "border-indigo-600 font-bold text-slate-900"
                : "border-transparent font-semibold text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === "flujo" ? (
        <FlujoFinanzas
          categorias={categorias}
          fuentes={fuentes}
          cargos={cargos}
          deuda={deuda}
          onAbrirAjustes={() => setAjustes(true)}
        />
      ) : (
        <>
          {/* Período */}
          <div
            role="tablist"
            aria-label="Período"
            className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
          >
            {(["semana", "mes", "año"] as Periodo[]).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={periodo === p}
                onClick={() => {
                  setPeriodo(p);
                  setOffset(0);
                }}
                className={`min-h-[40px] rounded-lg text-sm capitalize ${
                  periodo === p
                    ? "bg-white font-bold text-slate-900 shadow-sm"
                    : "font-semibold text-slate-500"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Período anterior"
              onClick={() => setOffset((o) => o - 1)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-[15px] font-bold text-slate-800">
              {tituloPeriodo(periodo, desde, hasta)}
            </span>
            <button
              type="button"
              aria-label="Período siguiente"
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 0}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {/* Resumen */}
            <section aria-label="Resumen" className="rounded-3xl border bg-white p-5 md:col-span-2">
              <p className="text-sm font-semibold text-slate-500">
                {queda >= 0 ? "Te quedan" : "Gastaste más de lo que entró"}{" "}
                {periodo === "semana" ? "esta semana" : periodo === "mes" ? "este mes" : "este año"}
              </p>
              <p
                className={`mt-1 text-4xl font-extrabold tracking-tight ${queda < 0 ? "text-rose-700" : "text-slate-900"}`}
              >
                {clp(queda)}
              </p>
              {r.porRecibir > 0 ? (
                <p className="mt-1 text-sm font-semibold text-indigo-700">
                  + {clp(r.porRecibir)} por recibir
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  <p className="text-xs text-slate-600">Entró</p>
                  <p className="text-lg font-bold text-emerald-700">{clp(r.entro)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  <p className="text-xs text-slate-600">Salió</p>
                  <p className="text-lg font-bold text-rose-700">{clp(r.salio)}</p>
                </div>
              </div>
            </section>

            {/* Dona */}
            <section aria-label="Gastos por categoría" className="rounded-3xl border bg-white p-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Gastos por categoría
              </h2>
              {r.porCategoria.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Sin gastos en este período.</p>
              ) : (
                <div className="mt-3 flex items-center gap-4">
                  <Dona partes={r.porCategoria} total={r.salio} />
                  <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
                    {r.porCategoria.slice(0, 7).map((c) => (
                      <li key={c.id ?? "none"} className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded"
                          style={{ background: c.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                        <span className="font-bold tabular-nums">
                          {Math.round((c.monto / r.salio) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Ingresos por fuente */}
            <section aria-label="Ingresos por fuente" className="rounded-3xl border bg-white p-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Ingresos por fuente
              </h2>
              {r.porFuente.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Agrega tus fuentes en{" "}
                  <button
                    type="button"
                    onClick={() => setAjustes(true)}
                    className="font-semibold text-indigo-700 underline"
                  >
                    Ajustes
                  </button>
                  .
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {r.porFuente.map((f) => {
                    const llego = f.recibido > 0 && (!f.esperado || f.recibido >= f.esperado);
                    const falta = periodo === "mes" && !!f.esperado && f.recibido < f.esperado;
                    return (
                      <li key={f.id} className="flex items-center gap-2.5 text-sm">
                        {llego ? (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-700">
                            ✓
                          </span>
                        ) : (
                          <span
                            aria-hidden
                            className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-indigo-300"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {f.nombre}
                          {falta ? (
                            <span className="ml-1 text-xs font-medium text-indigo-700">
                              · falta
                            </span>
                          ) : null}
                        </span>
                        <span className="font-bold tabular-nums">
                          {f.recibido > 0
                            ? clp(f.recibido)
                            : f.esperado && periodo === "mes"
                              ? clp(f.esperado)
                              : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Tarjeta y cargos fijos */}
            <section className="grid grid-cols-2 gap-3 md:col-span-2">
              <div className="rounded-2xl border bg-white px-4 py-3">
                <p className="text-xs text-slate-600">Debes en la tarjeta</p>
                <p className="text-lg font-extrabold">{clp(deuda)}</p>
                <button
                  type="button"
                  onClick={() => setHoja({ open: true, mov: null, tipo: "card_payment" })}
                  className="mt-1 text-xs font-bold text-indigo-700"
                >
                  Pagar tarjeta
                </button>
              </div>
              <button
                type="button"
                onClick={() => setAjustes(true)}
                className="rounded-2xl border bg-white px-4 py-3 text-left"
              >
                <p className="text-xs text-slate-600">Cargos fijos al mes</p>
                <p className="text-lg font-extrabold">{clp(totalCargos)}</p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {cargos.length > 0
                    ? cargos.map((c) => c.name).join(" · ")
                    : "Agregar suscripciones"}
                </p>
              </button>
            </section>

            {/* Movimientos */}
            <section
              aria-label="Movimientos"
              className="rounded-3xl border bg-white py-2 md:col-span-2"
            >
              <h2 className="px-5 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Movimientos
              </h2>
              {movsQ.isLoading ? (
                <p className="px-5 py-4 text-sm text-slate-500">Cargando…</p>
              ) : movs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">
                  Todavía no hay movimientos en este período. Toca + para registrar el primero.
                </p>
              ) : (
                <ul>
                  {movs.map((m) => {
                    const cat = m.category_id ? catById.get(m.category_id) : undefined;
                    const fuente = m.income_source_id
                      ? fuenteById.get(m.income_source_id)
                      : undefined;
                    const titulo =
                      m.kind === "income"
                        ? (fuente?.name ?? "Ingreso")
                        : m.kind === "card_payment"
                          ? "Pago de tarjeta"
                          : m.note || cat?.name || "Gasto";
                    const detalle = [
                      fechaCorta(m.occurred_on),
                      m.kind === "expense"
                        ? cat?.name
                        : m.kind === "income"
                          ? "Ingreso"
                          : "Baja la deuda",
                      m.kind === "expense"
                        ? m.payment_method === "credito"
                          ? "Tarjeta"
                          : "Débito"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li key={m.id} className="border-t border-slate-100 first:border-t-0">
                        <button
                          type="button"
                          onClick={() =>
                            setHoja({ open: true, mov: m, tipo: m.kind as MovementKind })
                          }
                          className="flex min-h-[56px] w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-50"
                        >
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded"
                            style={{
                              background:
                                m.kind === "income"
                                  ? "#10b981"
                                  : m.kind === "card_payment"
                                    ? "#64748b"
                                    : (cat?.color ?? "#cbd5e1"),
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {titulo}
                              {m.recurring_charge_id ? (
                                <span className="ml-1.5 text-[11px] font-semibold text-indigo-700">
                                  ↻ fijo
                                </span>
                              ) : null}
                            </span>
                            <span className="block truncate text-xs text-slate-500">{detalle}</span>
                          </span>
                          <span
                            className={`shrink-0 text-sm font-bold tabular-nums ${
                              m.kind === "income" ? "text-emerald-700" : "text-slate-900"
                            }`}
                          >
                            {m.kind === "income" ? "+" : "−"}
                            {clp(m.amount)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {/* "+" del celular (reemplaza al de "Nueva tarea" en esta pantalla) */}
      <button
        type="button"
        aria-label="Registrar movimiento"
        onClick={() => setHoja({ open: true, mov: null, tipo: "expense" })}
        className="fixed bottom-20 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <MovimientoSheet
        open={hoja.open}
        onOpenChange={(open) => setHoja((h) => ({ ...h, open }))}
        movimiento={hoja.mov}
        tipoInicial={hoja.tipo}
        categorias={categorias}
        fuentes={fuentes}
        onAbrirAjustes={() => {
          setHoja((h) => ({ ...h, open: false }));
          setAjustes(true);
        }}
      />
      <AjustesFinanzasSheet
        open={ajustes}
        onOpenChange={setAjustes}
        categorias={categorias}
        fuentes={fuentes}
        cargos={cargos}
      />
    </div>
  );
}

// ------------------------------------------------------------

function Dona({
  partes,
  total,
}: {
  partes: { id: string | null; color: string; monto: number }[];
  total: number;
}) {
  const r = 54;
  const C = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 132 132"
      role="img"
      aria-label="Gastos por categoría"
      className="shrink-0"
    >
      <g transform="rotate(-90 66 66)" fill="none" strokeWidth="18">
        {partes.map((p) => {
          const largo = total > 0 ? (p.monto / total) * C : 0;
          const el = (
            <circle
              key={p.id ?? "none"}
              cx="66"
              cy="66"
              r={r}
              stroke={p.color}
              strokeDasharray={`${largo} ${C}`}
              strokeDashoffset={-acumulado}
            />
          );
          acumulado += largo;
          return el;
        })}
      </g>
      <text x="66" y="62" textAnchor="middle" fontSize="11" fill="#64748b">
        Gastos
      </text>
      <text x="66" y="80" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0f172a">
        {total >= 1_000_000 ? `$${(total / 1_000_000).toFixed(1).replace(".", ",")} M` : clp(total)}
      </text>
    </svg>
  );
}
