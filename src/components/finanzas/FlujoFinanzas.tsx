/**
 * ========================================================
 * FlujoFinanzas — planificar la plata mes a mes
 *
 * Tabla con 6 meses en columnas (flechas para moverse):
 * - Entra: una fila por fuente de ingreso.
 * - Sale: una fila por categoría de gasto + el abono a la tarjeta.
 * - Resultado del mes, acumulado y deuda de la tarjeta al cierre.
 *
 * Cada celda se escribe a mano. Si queda vacía, se usa el automático
 * (en gris): el esperado de la fuente o los cargos fijos de la categoría.
 * Borrar el número vuelve al automático; escribir 0 es "nada ese mes".
 * En el mes actual y los pasados aparece debajo lo real registrado.
 * "Usar sugerencias" llena los gastos vacíos con el promedio real.
 * ========================================================
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clp,
  fetchMovements,
  parseMonto,
  type CategoryRow,
  type IncomeSourceRow,
  type RecurringChargeRow,
} from "@/services/financeService";
import {
  armarFlujo,
  esCategoriaHistorica,
  fetchPlan,
  insertPlanCells,
  mesesFlujo,
  mesTitulo,
  promedioPorCategoria,
  savePlanCell,
  type CeldaFlujo,
  type FilaFlujo,
} from "@/services/financeFlowService";

interface Props {
  categorias: CategoryRow[];
  fuentes: IncomeSourceRow[];
  cargos: RecurringChargeRow[];
  deuda: number;
  onAbrirAjustes: () => void;
}

export function FlujoFinanzas({ categorias, fuentes, cargos, deuda, onAbrirAjustes }: Props) {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [llenando, setLlenando] = useState(false);
  const meses = useMemo(() => mesesFlujo(offset), [offset]);
  const hoy = new Date();
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const primero = meses[0];
  const ultimo = meses[meses.length - 1];
  const finUltimo = new Date(ultimo.getFullYear(), ultimo.getMonth() + 1, 0);
  // Para sugerencias: 3 meses antes del actual (o antes, si se mira atrás).
  const desdeMovs = new Date(
    Math.min(primero.getTime(), new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1).getTime()),
  );

  const planQ = useQuery({
    queryKey: ["finanzas", "plan", offset],
    queryFn: () => fetchPlan(primero, ultimo),
  });
  const movsQ = useQuery({
    queryKey: ["finanzas", "flujo-movs", localKey(desdeMovs), localKey(finUltimo)],
    queryFn: () => fetchMovements(desdeMovs, finUltimo),
  });

  const flujo = useMemo(
    () =>
      armarFlujo({
        meses,
        plan: planQ.data ?? [],
        movs: movsQ.data ?? [],
        categorias,
        fuentes,
        cargos,
        deudaHoy: deuda,
      }),
    [meses, planQ.data, movsQ.data, categorias, fuentes, cargos, deuda],
  );
  const sugerencias = useMemo(
    () =>
      promedioPorCategoria(
        movsQ.data ?? [],
        mesActual,
        new Set(categorias.filter(esCategoriaHistorica).map((c) => c.id)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movsQ.data, categorias],
  );

  const refrescar = () => qc.invalidateQueries({ queryKey: ["finanzas", "plan"] });

  async function guardar(fila: FilaFlujo, i: number, texto: string) {
    const limpio = texto.replace(/[^\d]/g, "");
    const amount = limpio === "" ? null : parseMonto(limpio);
    const c = fila.celdas[i];
    if (amount === null && !c.fila) return;
    if (amount !== null && c.fila && c.fila.amount === amount) return;
    try {
      await savePlanCell(flujo.meses[i], fila.key, amount, c.fila);
      await refrescar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  async function usarSugerencias() {
    const celdas: { mes: Date; categoryId: string; amount: number }[] = [];
    for (const fila of flujo.gastos) {
      const cat = categorias.find((c) => c.id === fila.key.ref);
      if (!cat || esCategoriaHistorica(cat)) continue;
      const sug = sugerencias.get(cat.id) ?? 0;
      if (sug <= 0) continue;
      fila.celdas.forEach((c, i) => {
        if (flujo.estado[i] >= 0 && !c.fila)
          celdas.push({ mes: flujo.meses[i], categoryId: cat.id, amount: Math.max(sug, c.plan) });
      });
    }
    if (celdas.length === 0) {
      toast("No hay gastos vacíos que llenar.");
      return;
    }
    setLlenando(true);
    try {
      await insertPlanCells(celdas);
      await refrescar();
      toast.success("Listo. Ajusta los números que no te calcen.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setLlenando(false);
    }
  }

  const rojo = flujo.totales.findIndex((t) => t.acumulado < 0);
  const ceroTarjeta = flujo.totales.findIndex(
    (t, i) => flujo.estado[i] >= 0 && t.deudaCierre === 0,
  );
  const deudaFinal = flujo.totales[flujo.totales.length - 1].deudaCierre;

  const cargando = planQ.isLoading || movsQ.isLoading;

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Meses anteriores"
            onClick={() => setOffset((o) => o - 1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[8.5rem] text-center text-[15px] font-bold capitalize text-slate-800">
            {mesTitulo(primero)} – {mesTitulo(ultimo)}
          </span>
          <button
            type="button"
            aria-label="Meses siguientes"
            onClick={() => setOffset((o) => o + 1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAbrirAjustes}>
            <Plus className="h-4 w-4" /> Fuente
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={llenando || cargando}
            onClick={() => void usarSugerencias()}
          >
            <Sparkles className="h-4 w-4" /> {llenando ? "Llenando…" : "Usar sugerencias"}
          </Button>
        </div>
      </div>

      {/* Lectura rápida */}
      {!cargando ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${rojo >= 0 ? "bg-rose-50 text-rose-900" : "bg-emerald-50 text-emerald-900"}`}
          >
            {rojo >= 0 ? (
              <>
                En <b className="capitalize">{mesTitulo(flujo.meses[rojo])}</b> el acumulado queda
                en <b>{clp(flujo.totales[rojo].acumulado)}</b>. Es el mes a preparar.
              </>
            ) : (
              <>
                Con este plan, el acumulado se mantiene positivo hasta{" "}
                <b className="capitalize">{mesTitulo(ultimo)}</b>.
              </>
            )}
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {deuda === 0 ? (
              <>La tarjeta está en $0. Mantenla así.</>
            ) : ceroTarjeta >= 0 ? (
              <>
                Con estos abonos, la tarjeta queda en $0 en{" "}
                <b className="capitalize">{mesTitulo(flujo.meses[ceroTarjeta])}</b>.
              </>
            ) : (
              <>
                Con estos abonos, a fin de <span className="capitalize">{mesTitulo(ultimo)}</span>{" "}
                debes <b>{clp(deudaFinal)}</b> en la tarjeta.
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-3xl border bg-white">
        {cargando ? (
          <p className="px-5 py-6 text-sm text-slate-500">Cargando el flujo…</p>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-36 min-w-[9rem] bg-white px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Mes
                </th>
                {flujo.meses.map((m, i) => (
                  <th
                    key={m.getTime()}
                    className={`min-w-[7.5rem] px-2 py-3 text-right text-xs font-bold uppercase tracking-wide ${
                      flujo.estado[i] === 0 ? "text-indigo-700" : "text-slate-500"
                    }`}
                  >
                    {mesTitulo(m)}
                    {flujo.estado[i] === 0 ? (
                      <span className="block text-[10px] font-semibold normal-case">este mes</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Seccion titulo="Entra" columnas={flujo.meses.length} />
              {flujo.ingresos.length === 0 ? (
                <tr>
                  <td colSpan={flujo.meses.length + 1} className="px-3 py-2 text-slate-500">
                    Agrega tus fuentes con “+ Fuente”.
                  </td>
                </tr>
              ) : (
                flujo.ingresos.map((f) => (
                  <FilaEditable
                    key={f.key.ref}
                    fila={f}
                    estado={flujo.estado}
                    tipo="ingreso"
                    onGuardar={guardar}
                  />
                ))
              )}
              <FilaTotal
                nombre="Total entra"
                valores={flujo.totales.map((t) => t.entra)}
                clase="text-emerald-700"
              />

              <Seccion titulo="Sale" columnas={flujo.meses.length} />
              {flujo.gastos.map((f) => (
                <FilaEditable
                  key={f.key.ref}
                  fila={f}
                  estado={flujo.estado}
                  tipo="gasto"
                  onGuardar={guardar}
                />
              ))}
              <FilaEditable
                fila={flujo.abono}
                estado={flujo.estado}
                tipo="abono"
                onGuardar={guardar}
              />
              <FilaTotal
                nombre="Total sale"
                valores={flujo.totales.map((t) => t.sale)}
                clase="text-rose-700"
              />

              <Seccion titulo="Resultado" columnas={flujo.meses.length} />
              <tr>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-slate-700">
                  Del mes
                </td>
                {flujo.totales.map((t, i) => (
                  <td key={i} className="px-2 py-2 text-right tabular-nums">
                    <span
                      className={`font-extrabold ${t.resultado < 0 ? "text-rose-700" : "text-slate-900"}`}
                    >
                      {clp(t.resultado)}
                    </span>
                    {t.resultadoReal !== null ? (
                      <span className="block text-[11px] text-slate-500">
                        real {clp(t.resultadoReal)}
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-slate-700">
                  Acumulado
                </td>
                {flujo.totales.map((t, i) => (
                  <td
                    key={i}
                    className={`px-2 py-2 text-right font-bold tabular-nums ${t.acumulado < 0 ? "bg-rose-50 text-rose-700" : "text-slate-900"}`}
                  >
                    {clp(t.acumulado)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-slate-700">
                  Deuda tarjeta al cierre
                </td>
                {flujo.totales.map((t, i) => (
                  <td key={i} className="px-2 py-2 text-right tabular-nums text-slate-700">
                    {Number.isNaN(t.deudaCierre) ? "—" : clp(t.deudaCierre)}
                    {t.conTarjeta > 0 && flujo.estado[i] >= 0 ? (
                      <span className="block text-[11px] font-semibold text-amber-700">
                        usaste {clp(t.conTarjeta)} con tarjeta
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        En gris va el automático: lo esperado de cada fuente y los cargos fijos de cada categoría.
        Escribe encima para planear; borra el número para volver al automático. El acumulado parte
        en {mesTitulo(primero)}. Lo gastado con tarjeta no sale de tu cuenta ese mes: suma a la
        deuda.
      </p>
    </div>
  );
}

function localKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ------------------------------------------------------------

function Seccion({ titulo, columnas }: { titulo: string; columnas: number }) {
  return (
    <tr>
      <td
        colSpan={columnas + 1}
        className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
      >
        <span className="sticky left-3">{titulo}</span>
      </td>
    </tr>
  );
}

function FilaTotal({
  nombre,
  valores,
  clase,
}: {
  nombre: string;
  valores: number[];
  clase: string;
}) {
  return (
    <tr>
      <td className="sticky left-0 z-10 border-t border-slate-100 bg-white px-3 py-2 font-bold text-slate-800">
        {nombre}
      </td>
      {valores.map((v, i) => (
        <td
          key={i}
          className={`border-t border-slate-100 px-2 py-2 text-right font-bold tabular-nums ${clase}`}
        >
          {clp(v)}
        </td>
      ))}
    </tr>
  );
}

function FilaEditable({
  fila,
  estado,
  tipo,
  onGuardar,
}: {
  fila: FilaFlujo;
  estado: (-1 | 0 | 1)[];
  tipo: "ingreso" | "gasto" | "abono";
  onGuardar: (fila: FilaFlujo, i: number, texto: string) => Promise<void>;
}) {
  return (
    <tr>
      <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
        <span className="flex items-center gap-2">
          {fila.color ? (
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded"
              style={{ background: fila.color }}
            />
          ) : null}
          <span className="truncate text-slate-800" title={fila.nombre}>
            {fila.nombre}
          </span>
        </span>
      </td>
      {fila.celdas.map((c, i) => (
        <td key={i} className="px-1.5 py-1 align-top">
          <CeldaInput
            celda={c}
            nombre={`${fila.nombre}, mes ${i + 1}`}
            onGuardar={(t) => onGuardar(fila, i, t)}
          />
          {c.real !== null && (c.real > 0 || estado[i] === -1) ? (
            <Real celda={c} tipo={tipo} pasado={estado[i] === -1} />
          ) : null}
        </td>
      ))}
    </tr>
  );
}

function CeldaInput({
  celda,
  nombre,
  onGuardar,
}: {
  celda: CeldaFlujo;
  nombre: string;
  onGuardar: (texto: string) => Promise<void>;
}) {
  const valor = celda.fila ? clp(celda.fila.amount) : "";
  return (
    <input
      key={`${celda.fila?.id ?? "auto"}-${celda.fila?.amount ?? celda.plan}`}
      aria-label={nombre}
      inputMode="numeric"
      defaultValue={valor}
      placeholder={celda.plan > 0 ? clp(celda.plan) : "—"}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const limpio = e.target.value.replace(/[^\d]/g, "");
        e.target.value = limpio === "" ? "" : clp(Number(limpio));
      }}
      onBlur={(e) => void onGuardar(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-right font-semibold tabular-nums text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 hover:border-slate-200 focus:border-indigo-400 focus:bg-white"
    />
  );
}

function Real({
  celda,
  tipo,
  pasado,
}: {
  celda: CeldaFlujo;
  tipo: "ingreso" | "gasto" | "abono";
  pasado: boolean;
}) {
  const real = celda.real ?? 0;
  // Gasto: pasarse del plan es aviso desde ya. Ingreso/abono: sólo al cerrar el mes.
  const malo = tipo === "gasto" ? celda.plan > 0 && real > celda.plan : pasado && real < celda.plan;
  return (
    <span
      className={`block px-2 text-right text-[11px] tabular-nums ${malo ? "font-semibold text-rose-600" : "text-slate-500"}`}
    >
      real {clp(real)}
    </span>
  );
}
