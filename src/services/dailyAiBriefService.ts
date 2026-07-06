/**
 * ========================================================
 * Archivo: dailyAiBriefService — Daily AI Brief (cliente)
 *
 * Responsabilidad:
 * Fachada de cliente para el Agente Inteligente de CalmApp.
 * Orquesta:
 *   1) Consumir `getDailyContext()` (Daily Context Engine).
 *   2) Invocar la server function `generateDailyBrief` que
 *      construye el prompt, llama al modelo y valida el JSON.
 *   3) Persistir la última respuesta en `localStorage` como
 *      log ligero para pruebas del MVP2. NO se muestra al
 *      usuario todavía.
 *
 * Reglas:
 * - No modifica FOCO, Calendario ni ninguna otra pantalla.
 * - No genera notificaciones ni cambia tareas.
 * - Nunca lanza excepciones al llamador: si el modelo falla,
 *   devuelve `{ ok: false, error }`.
 *
 * Consumo posterior (interfaz "Tu Día"):
 *   const result = await getDailyBrief();
 *   if (result.ok) render(result.brief);
 *   else showFallback(result.error);
 * ========================================================
 */
import { getDailyContext, type DailyContext } from "@/services/dailyContextService";
import {
  generateDailyBrief,
  type DailyBrief,
  type DailyBriefResult,
} from "@/lib/dailyBrief.functions";

export type { DailyBrief, DailyBriefResult };

const LOG_KEY = "calmapp.dailyBrief.lastLog";
const LOG_MAX = 20;

interface BriefLogEntry {
  at: string; // ISO
  contextDate: string;
  ok: boolean;
  error?: string;
  brief?: DailyBrief;
}

function readLog(): BriefLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as BriefLogEntry[]) : [];
  } catch {
    return [];
  }
}

function appendLog(entry: BriefLogEntry) {
  try {
    const log = readLog();
    log.unshift(entry);
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_MAX)));
  } catch {
    /* localStorage no disponible: silencioso */
  }
}

/** Devuelve el histórico local de briefs (útil para pruebas del MVP2). */
export function getDailyBriefLog(): BriefLogEntry[] {
  return readLog();
}

/**
 * Genera el brief del día. Toma opcionalmente un contexto ya
 * construido para permitir tests o pantallas que ya lo cargaron.
 */
export async function getDailyBrief(options?: {
  context?: DailyContext;
  now?: Date;
}): Promise<DailyBriefResult> {
  const context = options?.context ?? (await getDailyContext(options?.now));
  const result = await generateDailyBrief({ data: context as unknown as Record<string, unknown> });

  appendLog({
    at: new Date().toISOString(),
    contextDate: context.date,
    ok: result.ok,
    error: result.ok ? undefined : result.error,
    brief: result.ok ? result.brief : undefined,
  });

  return result;
}
