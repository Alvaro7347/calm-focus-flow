/**
 * ========================================================
 * Archivo: financeFlowService — Finanzas · Flujo
 *
 * Planificación mes a mes de la plata del hogar:
 * - Ingresos proyectados por fuente (UNAB, UTEM, Seguro de cesantía…).
 * - Gastos proyectados por categoría (las mismas de los movimientos).
 * - Abono planeado a la tarjeta.
 *
 * Cada celda del plan es una fila de `finance_plan` (mes = día 1).
 * Si una celda no tiene plan, se usa un valor "automático":
 * - Ingreso: el monto esperado de la fuente.
 * - Gasto: la suma de los cargos fijos de esa categoría.
 * Lo real sale de `finance_movements`, para comparar plan vs real.
 *
 * Resultado de caja de un mes = entra − (gastos + abono a la tarjeta).
 * Lo gastado con tarjeta de crédito no sale de la cuenta ese mes: se
 * muestra aparte, porque suma a la deuda.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  localDate,
  type CategoryRow,
  type IncomeSourceRow,
  type MovementRow,
  type RecurringChargeRow,
} from "./financeService";

export type PlanRow = Database["public"]["Tables"]["finance_plan"]["Row"];
export type PlanKind = "income" | "expense" | "card_payment";

/** Identifica una celda: tipo + fuente/categoría (null para el abono). */
export interface PlanKey {
  kind: PlanKind;
  ref: string | null;
}

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function mesTitulo(mes: Date): string {
  return `${MESES_CORTOS[mes.getMonth()]} ${String(mes.getFullYear()).slice(2)}`;
}

/** Primer día de los `n` meses desde el mes actual + offset. */
export function mesesFlujo(offset: number, n = 6, hoy = new Date()): Date[] {
  return Array.from(
    { length: n },
    (_, i) => new Date(hoy.getFullYear(), hoy.getMonth() + offset + i, 1),
  );
}

function finDeMes(mes: Date): Date {
  return new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
}

function claveCelda(mes: string, kind: string, ref: string | null) {
  return `${mes}|${kind}|${ref ?? ""}`;
}

// ------------------------------------------------------------
// Datos
// ------------------------------------------------------------

export async function fetchPlan(desde: Date, hasta: Date): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from("finance_plan")
    .select("*")
    .gte("month", localDate(desde))
    .lte("month", localDate(hasta));
  if (error) throw error;
  return (data ?? []) as PlanRow[];
}

/**
 * Guarda una celda del plan. `amount = null` la borra (vuelve al automático).
 * `existente` es la fila que ya había en esa celda, si la hay.
 */
export async function savePlanCell(
  mes: Date,
  key: PlanKey,
  amount: number | null,
  existente?: PlanRow,
): Promise<void> {
  if (amount === null) {
    if (!existente) return;
    const { error } = await supabase.from("finance_plan").delete().eq("id", existente.id);
    if (error) throw error;
    return;
  }
  if (existente) {
    if (existente.amount === amount) return;
    const { error } = await supabase.from("finance_plan").update({ amount }).eq("id", existente.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("finance_plan").insert({
    month: localDate(mes),
    kind: key.kind,
    amount,
    income_source_id: key.kind === "income" ? key.ref : null,
    category_id: key.kind === "expense" ? key.ref : null,
  });
  if (error) throw error;
}

/** Inserta varias celdas nuevas de una vez (para "Usar sugerencias"). */
export async function insertPlanCells(
  celdas: { mes: Date; categoryId: string; amount: number }[],
): Promise<void> {
  if (celdas.length === 0) return;
  const { error } = await supabase.from("finance_plan").insert(
    celdas.map((c) => ({
      month: localDate(c.mes),
      kind: "expense",
      category_id: c.categoryId,
      amount: c.amount,
    })),
  );
  if (error) throw error;
}

// ------------------------------------------------------------
// Sugerencias: promedio real de gasto por categoría
// ------------------------------------------------------------

/** Categorías que no son gasto del mes a mes (no se sugieren ni se muestran vacías). */
export function esCategoriaHistorica(c: CategoryRow): boolean {
  return /deuda anterior/i.test(c.name);
}

/**
 * Promedio mensual de gasto por categoría, mirando los últimos `meses`
 * meses completos antes de `antesDe` que tengan gastos. Se ignoran las
 * categorías de `excluir` (p. ej. "Deuda anterior de la tarjeta").
 */
export function promedioPorCategoria(
  movs: MovementRow[],
  antesDe: Date,
  excluir: Set<string> = new Set(),
  meses = 3,
): Map<string, number> {
  const limite = localDate(antesDe);
  const desde = localDate(new Date(antesDe.getFullYear(), antesDe.getMonth() - meses, 1));
  const conDatos = new Set<string>();
  const suma = new Map<string, number>();
  for (const m of movs) {
    if (m.kind !== "expense" || !m.category_id || excluir.has(m.category_id)) continue;
    if (m.occurred_on < desde || m.occurred_on >= limite) continue;
    conDatos.add(m.occurred_on.slice(0, 7));
    suma.set(m.category_id, (suma.get(m.category_id) ?? 0) + m.amount);
  }
  const n = Math.max(1, conDatos.size);
  const out = new Map<string, number>();
  for (const [k, v] of suma) out.set(k, Math.round(v / n / 1000) * 1000);
  return out;
}

// ------------------------------------------------------------
// Armar la tabla del flujo
// ------------------------------------------------------------

export interface CeldaFlujo {
  /** Lo planeado que cuenta (plan explícito o automático). */
  plan: number;
  /** true si `plan` viene del automático (no lo escribiste tú). */
  auto: boolean;
  /** La fila guardada, si escribiste un valor. */
  fila?: PlanRow;
  /** Lo real del mes (sólo meses pasados o el actual). */
  real: number | null;
}

export interface FilaFlujo {
  key: PlanKey;
  nombre: string;
  color?: string | null;
  celdas: CeldaFlujo[];
}

export interface Flujo {
  meses: Date[];
  /** -1 pasado, 0 actual, 1 futuro. */
  estado: (-1 | 0 | 1)[];
  ingresos: FilaFlujo[];
  gastos: FilaFlujo[];
  abono: FilaFlujo;
  totales: {
    entra: number;
    sale: number;
    resultado: number;
    acumulado: number;
    /** Real (pasado/actual): entra − gastos con débito − pagos de tarjeta. */
    resultadoReal: number | null;
    /** Gastado con tarjeta de crédito en el mes (real). */
    conTarjeta: number;
    /** Deuda de la tarjeta proyectada al cierre del mes. */
    deudaCierre: number;
  }[];
}

export function armarFlujo(input: {
  meses: Date[];
  plan: PlanRow[];
  movs: MovementRow[];
  categorias: CategoryRow[];
  fuentes: IncomeSourceRow[];
  cargos: RecurringChargeRow[];
  deudaHoy: number;
  hoy?: Date;
}): Flujo {
  const { meses, plan, movs, categorias, fuentes, cargos, deudaHoy } = input;
  const hoy = input.hoy ?? new Date();
  const mesHoy = localDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const claves = meses.map((m) => localDate(m));
  const estado = claves.map((k) => (k < mesHoy ? -1 : k === mesHoy ? 0 : 1)) as (-1 | 0 | 1)[];

  const planPor = new Map<string, PlanRow>();
  for (const p of plan) {
    const ref =
      p.kind === "income" ? p.income_source_id : p.kind === "expense" ? p.category_id : null;
    planPor.set(claveCelda(p.month, p.kind, ref), p);
  }

  // Real por mes
  const real = new Map<string, number>();
  const sumar = (k: string, n: number) => real.set(k, (real.get(k) ?? 0) + n);
  const debitoMes = new Map<string, number>();
  const creditoMes = new Map<string, number>();
  for (const m of movs) {
    const mes = `${m.occurred_on.slice(0, 7)}-01`;
    if (m.kind === "income") sumar(claveCelda(mes, "income", m.income_source_id), m.amount);
    else if (m.kind === "card_payment") sumar(claveCelda(mes, "card_payment", null), m.amount);
    else if (m.kind === "expense") {
      sumar(claveCelda(mes, "expense", m.category_id), m.amount);
      const t = m.payment_method === "credito" ? creditoMes : debitoMes;
      t.set(mes, (t.get(mes) ?? 0) + m.amount);
    }
  }

  // Cargos fijos por categoría y mes (automático de gastos)
  const fijos = (catId: string, mes: Date) =>
    cargos
      .filter((c) => c.category_id === catId && c.start_date <= localDate(finDeMes(mes)))
      .reduce((n, c) => n + c.amount, 0);

  const celda = (i: number, key: PlanKey, auto: number): CeldaFlujo => {
    const k = claveCelda(claves[i], key.kind, key.ref);
    const fila = planPor.get(k);
    return {
      plan: fila ? fila.amount : auto,
      auto: !fila,
      fila,
      real: estado[i] <= 0 ? (real.get(k) ?? 0) : null,
    };
  };

  const ingresos: FilaFlujo[] = fuentes.map((f) => {
    const key: PlanKey = { kind: "income", ref: f.id };
    return {
      key,
      nombre: f.name,
      celdas: meses.map((_, i) => celda(i, key, f.expected_amount ?? 0)),
    };
  });

  const gastos: FilaFlujo[] = categorias
    .map((c) => {
      const key: PlanKey = { kind: "expense", ref: c.id };
      return {
        key,
        nombre: c.name,
        color: c.color,
        celdas: meses.map((m, i) => celda(i, key, fijos(c.id, m))),
      };
    })
    .filter(
      (f) =>
        !esCategoriaHistorica(categorias.find((c) => c.id === f.key.ref)!) ||
        f.celdas.some((c) => c.plan > 0 || (c.real ?? 0) > 0),
    );

  const abonoKey: PlanKey = { kind: "card_payment", ref: null };
  const abono: FilaFlujo = {
    key: abonoKey,
    nombre: "Abono a la tarjeta",
    celdas: meses.map((_, i) => celda(i, abonoKey, 0)),
  };

  let acumulado = 0;
  let deuda = deudaHoy;
  const totales = meses.map((_, i) => {
    const entra = ingresos.reduce((n, f) => n + f.celdas[i].plan, 0);
    const gasto = gastos.reduce((n, f) => n + f.celdas[i].plan, 0);
    const ab = abono.celdas[i].plan;
    const sale = gasto + ab;
    const resultado = entra - sale;
    acumulado += resultado;
    const k = claves[i];
    const resultadoReal =
      estado[i] <= 0
        ? ingresos.reduce((n, f) => n + (f.celdas[i].real ?? 0), 0) -
          (debitoMes.get(k) ?? 0) -
          (abono.celdas[i].real ?? 0)
        : null;
    // Deuda proyectada: la de hoy ya incluye lo pasado; desde el mes actual
    // baja con lo que falte abonar según el plan.
    if (estado[i] === 0) deuda -= Math.max(0, ab - (abono.celdas[i].real ?? 0));
    else if (estado[i] === 1) deuda -= ab;
    deuda = Math.max(0, deuda);
    return {
      entra,
      sale,
      resultado,
      acumulado,
      resultadoReal,
      conTarjeta: creditoMes.get(k) ?? 0,
      deudaCierre: estado[i] === -1 ? NaN : deuda,
    };
  });

  return { meses, estado, ingresos, gastos, abono, totales };
}
