/**
 * ========================================================
 * Archivo: financeService — Finanzas del hogar
 *
 * Gestor de gastos personal (solo el hogar). Un usuario, sus datos.
 *
 * Conceptos:
 * - Fuentes de ingreso (UNAB, UTEM, ukelele…), con monto esperado
 *   al mes opcional. Cada ingreso se registra cuando llega.
 * - Cargos fijos automáticos (ChatGPT, Canva…): monto, día de cobro y
 *   medio de pago. `syncRecurringCharges` los anota solos cada mes.
 * - Movimientos: gasto (categoría + medio de pago), ingreso (fuente)
 *   o pago de tarjeta (salda deuda; NO es gasto).
 * - Deuda de la tarjeta = gastos con tarjeta de crédito − pagos de tarjeta.
 *
 * Montos en pesos enteros. Fechas de movimiento: YYYY-MM-DD local.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type CategoryRow = Tables["finance_categories"]["Row"];
export type IncomeSourceRow = Tables["income_sources"]["Row"];
export type RecurringChargeRow = Tables["recurring_charges"]["Row"];
export type MovementRow = Tables["finance_movements"]["Row"];
export type MovementInsert = Tables["finance_movements"]["Insert"];
export type SettingsRow = Tables["finance_settings"]["Row"];

export type MovementKind = "expense" | "income" | "card_payment";
export type PaymentMethod = "debito" | "credito";
export type Periodo = "semana" | "mes" | "año";

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

/** 1234567 → "$1.234.567" */
export function clp(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("es-CL")}`;
}

/** "$ 12.500" / "12500" → 12500 (enteros, sin signos). */
export function parseMonto(text: string): number {
  const n = Number(text.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocal(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Rango [desde, hasta] (fechas locales, inclusive) del período con desplazamiento. */
export function rangoPeriodo(periodo: Periodo, offset: number, hoy = new Date()) {
  if (periodo === "semana") {
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7) + offset * 7);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    return { desde: lunes, hasta: domingo };
  }
  if (periodo === "mes") {
    const desde = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
    const hasta = new Date(desde.getFullYear(), desde.getMonth() + 1, 0);
    return { desde, hasta };
  }
  const desde = new Date(hoy.getFullYear() + offset, 0, 1);
  const hasta = new Date(desde.getFullYear(), 11, 31);
  return { desde, hasta };
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function tituloPeriodo(periodo: Periodo, desde: Date, hasta: Date): string {
  if (periodo === "año") return String(desde.getFullYear());
  if (periodo === "mes") {
    const t = `${MESES[desde.getMonth()]} ${desde.getFullYear()}`;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const corto = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
  return `${corto(desde)} – ${corto(hasta)}`;
}

/** "hoy", "ayer", "28 oct". */
export function fechaCorta(fecha: string, hoy = new Date()): string {
  const d = parseLocal(fecha);
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.round((h.getTime() - d.getTime()) / 864e5);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

// ------------------------------------------------------------
// Ajustes y bienvenida
// ------------------------------------------------------------

export const CATEGORIAS_INICIALES: { name: string; color: string }[] = [
  { name: "Arriendo o dividendo", color: "#6d4aff" },
  { name: "Supermercado", color: "#3b82f6" },
  { name: "Comida fuera", color: "#0d9488" },
  { name: "Cuentas básicas", color: "#f59e0b" },
  { name: "Transporte", color: "#db2777" },
  { name: "Salud", color: "#16a34a" },
  { name: "Educación", color: "#0ea5e9" },
  { name: "Ocio", color: "#f97316" },
  { name: "Suscripciones", color: "#a78bfa" },
  { name: "Otros", color: "#94a3b8" },
];

/** Colores para categorías nuevas (se rotan). */
export const COLORES = CATEGORIAS_INICIALES.map((c) => c.color);

export async function fetchSettings(): Promise<SettingsRow | null> {
  const { data, error } = await supabase.from("finance_settings").select("*").maybeSingle();
  if (error) throw error;
  return (data as SettingsRow | null) ?? null;
}

/** Cierra la bienvenida: moneda + categorías iniciales (si no tiene). */
export async function completeOnboarding(currency = "CLP"): Promise<void> {
  const { data: cats, error: e1 } = await supabase
    .from("finance_categories")
    .select("id")
    .is("archived_at", null)
    .limit(1);
  if (e1) throw e1;
  if ((cats ?? []).length === 0) {
    const { error } = await supabase
      .from("finance_categories")
      .insert(CATEGORIAS_INICIALES.map((c, i) => ({ ...c, display_order: i })));
    if (error) throw error;
  }
  const { error } = await supabase
    .from("finance_settings")
    .upsert({ currency, onboarded_at: new Date().toISOString() });
  if (error) throw error;
}

// ------------------------------------------------------------
// Categorías, fuentes y cargos fijos
// ------------------------------------------------------------

export async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .is("archived_at", null)
    .order("display_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function createCategory(name: string, color: string): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from("finance_categories")
    .insert({ name: name.trim(), color, display_order: 100 })
    .select("*")
    .single();
  if (error) throw friendly(error, "Ya tienes una categoría con ese nombre.");
  return data as CategoryRow;
}

export async function fetchIncomeSources(): Promise<IncomeSourceRow[]> {
  const { data, error } = await supabase
    .from("income_sources")
    .select("*")
    .is("archived_at", null)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as IncomeSourceRow[];
}

export async function createIncomeSource(
  name: string,
  expected: number | null,
): Promise<IncomeSourceRow> {
  const { data, error } = await supabase
    .from("income_sources")
    .insert({ name: name.trim(), expected_amount: expected && expected > 0 ? expected : null })
    .select("*")
    .single();
  if (error) throw friendly(error, "Ya tienes una fuente con ese nombre.");
  return data as IncomeSourceRow;
}

export async function updateIncomeSource(
  id: string,
  patch: { name?: string; expected_amount?: number | null },
): Promise<void> {
  const { error } = await supabase.from("income_sources").update(patch).eq("id", id);
  if (error) throw friendly(error, "Ya tienes una fuente con ese nombre.");
}

export async function fetchRecurringCharges(): Promise<RecurringChargeRow[]> {
  const { data, error } = await supabase
    .from("recurring_charges")
    .select("*")
    .is("archived_at", null)
    .order("day_of_month");
  if (error) throw error;
  return (data ?? []) as RecurringChargeRow[];
}

export async function createRecurringCharge(input: {
  name: string;
  amount: number;
  day_of_month: number;
  payment_method: PaymentMethod;
  category_id: string | null;
}): Promise<RecurringChargeRow> {
  const { data, error } = await supabase
    .from("recurring_charges")
    .insert({ ...input, name: input.name.trim() })
    .select("*")
    .single();
  if (error) throw friendly(error);
  return data as RecurringChargeRow;
}

export async function updateRecurringCharge(
  id: string,
  patch: Partial<Pick<RecurringChargeRow, "name" | "amount" | "day_of_month" | "payment_method">>,
): Promise<void> {
  const { error } = await supabase.from("recurring_charges").update(patch).eq("id", id);
  if (error) throw friendly(error);
}

/** Archivar (categoría, fuente o cargo fijo): deja de aparecer; su historia queda. */
export async function archive(
  table: "finance_categories" | "income_sources" | "recurring_charges",
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Anota los cargos fijos que ya se cobraron y aún no están registrados:
 * para cada cargo activo, cada mes desde su `start_date` hasta hoy, el día
 * de cobro (o el último del mes, si es más corto). Nunca duplica.
 */
export async function syncRecurringCharges(hoy = new Date()): Promise<number> {
  const charges = await fetchRecurringCharges();
  if (charges.length === 0) return 0;
  const { data: existentes, error } = await supabase
    .from("finance_movements")
    .select("recurring_charge_id, occurred_on")
    .not("recurring_charge_id", "is", null);
  if (error) throw error;
  const ya = new Set(
    ((existentes ?? []) as { recurring_charge_id: string; occurred_on: string }[]).map(
      (m) => `${m.recurring_charge_id}|${m.occurred_on}`,
    ),
  );
  const hoyStr = localDate(hoy);
  const nuevos: MovementInsert[] = [];
  for (const c of charges) {
    const inicio = parseLocal(c.start_date);
    for (
      let m = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
      m <= hoy;
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    ) {
      const ultimo = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const fecha = localDate(
        new Date(m.getFullYear(), m.getMonth(), Math.min(c.day_of_month, ultimo)),
      );
      if (fecha < c.start_date || fecha > hoyStr || ya.has(`${c.id}|${fecha}`)) continue;
      nuevos.push({
        kind: "expense",
        amount: c.amount,
        occurred_on: fecha,
        category_id: c.category_id,
        payment_method: c.payment_method,
        recurring_charge_id: c.id,
        note: c.name,
      });
    }
  }
  let creados = 0;
  for (const n of nuevos) {
    const { error: e } = await supabase.from("finance_movements").insert(n);
    if (!e) creados++; // un duplicado (otra pestaña lo anotó primero) se ignora
  }
  return creados;
}

// ------------------------------------------------------------
// Movimientos
// ------------------------------------------------------------

export async function fetchMovements(desde: Date, hasta: Date): Promise<MovementRow[]> {
  const rows: MovementRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("finance_movements")
      .select("*")
      .gte("occurred_on", localDate(desde))
      .lte("occurred_on", localDate(hasta))
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as MovementRow[]));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

export async function saveMovement(input: MovementInsert & { id?: string }): Promise<void> {
  const { id, ...fields } = input;
  const { error } = id
    ? await supabase.from("finance_movements").update(fields).eq("id", id)
    : await supabase.from("finance_movements").insert(fields);
  if (error) throw friendly(error);
}

/** Borrar un movimiento es corregir un error: se elimina de verdad. */
export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from("finance_movements").delete().eq("id", id);
  if (error) throw error;
}

/** Lo que debes hoy en la tarjeta: gastos con crédito − pagos de tarjeta (histórico). */
export async function fetchCardDebt(): Promise<number> {
  let total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("finance_movements")
      .select("kind, amount, payment_method")
      .or("payment_method.eq.credito,kind.eq.card_payment")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const m of (data ?? []) as Pick<MovementRow, "kind" | "amount" | "payment_method">[]) {
      if (m.kind === "card_payment") total -= m.amount;
      else if (m.kind === "expense") total += m.amount;
    }
    if ((data ?? []).length < 1000) break;
  }
  return Math.max(0, total);
}

// ------------------------------------------------------------
// Resumen de un período
// ------------------------------------------------------------

export interface ResumenPeriodo {
  entro: number;
  salio: number;
  /** Sólo en vista Mes: esperado de las fuentes que aún no llega. */
  porRecibir: number;
  porCategoria: { id: string | null; nombre: string; color: string; monto: number }[];
  porFuente: {
    id: string;
    nombre: string;
    recibido: number;
    esperado: number | null;
  }[];
}

export function resumir(
  movs: MovementRow[],
  categorias: CategoryRow[],
  fuentes: IncomeSourceRow[],
  periodo: Periodo,
): ResumenPeriodo {
  let entro = 0;
  let salio = 0;
  const cat = new Map<string, number>();
  const fuente = new Map<string, number>();
  for (const m of movs) {
    if (m.kind === "income") {
      entro += m.amount;
      if (m.income_source_id)
        fuente.set(m.income_source_id, (fuente.get(m.income_source_id) ?? 0) + m.amount);
    } else if (m.kind === "expense") {
      salio += m.amount;
      const k = m.category_id ?? "";
      cat.set(k, (cat.get(k) ?? 0) + m.amount);
    }
  }
  const catById = new Map(categorias.map((c) => [c.id, c]));
  const porCategoria = [...cat.entries()]
    .map(([id, monto]) => {
      const c = id ? catById.get(id) : undefined;
      return {
        id: id || null,
        nombre: c?.name ?? "Sin categoría",
        color: c?.color ?? "#cbd5e1",
        monto,
      };
    })
    .sort((a, b) => b.monto - a.monto);

  const porFuente = fuentes.map((f) => ({
    id: f.id,
    nombre: f.name,
    recibido: fuente.get(f.id) ?? 0,
    esperado: f.expected_amount,
  }));
  const porRecibir =
    periodo === "mes"
      ? porFuente.reduce((n, f) => n + (f.esperado ? Math.max(0, f.esperado - f.recibido) : 0), 0)
      : 0;

  return { entro, salio, porRecibir, porCategoria, porFuente };
}

/** Totales de la plata del hogar en un rango (para el Ritual). null si no usa Finanzas. */
export async function weekMoney(
  desde: Date,
  hasta: Date,
): Promise<{ entro: number; salio: number } | null> {
  const settings = await fetchSettings().catch(() => null);
  if (!settings?.onboarded_at) return null;
  const movs = await fetchMovements(desde, hasta);
  let entro = 0;
  let salio = 0;
  for (const m of movs) {
    if (m.kind === "income") entro += m.amount;
    else if (m.kind === "expense") salio += m.amount;
  }
  return { entro, salio };
}

function friendly(error: { code?: string; message: string }, dup?: string): Error {
  if (error.code === "23505" && dup) return new Error(dup);
  return new Error(error.message);
}
