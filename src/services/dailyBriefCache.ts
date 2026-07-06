/**
 * ========================================================
 * Archivo: dailyBriefCache
 *
 * Responsabilidad:
 * Cachear el `DailyBrief` generado por la IA una vez por día
 * en `localStorage`, y llevar registro de si ya se mostró la
 * pantalla "Tu Día" hoy.
 *
 * Reglas:
 * - No consulta Supabase.
 * - No llama a la IA directamente: sólo la invoca cuando no
 *   existe un brief cacheado para la fecha actual.
 * - Si la IA falla, devuelve `{ ok: false }` sin romper nada.
 * ========================================================
 */
import { getDailyBrief, type DailyBrief, type DailyBriefResult } from "@/services/dailyAiBriefService";

const BRIEF_KEY_PREFIX = "calmapp.tuDia.brief.";
const SHOWN_KEY = "calmapp.tuDia.shownDate";

function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface CachedBrief {
  date: string;
  brief: DailyBrief;
  savedAt: string;
}

export function readCachedBrief(date: string = todayISO()): DailyBrief | null {
  try {
    const raw = localStorage.getItem(BRIEF_KEY_PREFIX + date);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBrief;
    return parsed.brief ?? null;
  } catch {
    return null;
  }
}

function writeCachedBrief(date: string, brief: DailyBrief) {
  try {
    const entry: CachedBrief = { date, brief, savedAt: new Date().toISOString() };
    localStorage.setItem(BRIEF_KEY_PREFIX + date, JSON.stringify(entry));
    // Limpieza best-effort de fechas antiguas.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BRIEF_KEY_PREFIX) && k !== BRIEF_KEY_PREFIX + date) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* silencioso */
  }
}

/**
 * Devuelve el brief de hoy reutilizando el caché si existe.
 * Sólo invoca a la IA cuando el caché está vacío.
 */
export async function getOrLoadTodayBrief(options?: { force?: boolean; now?: Date }): Promise<DailyBriefResult> {
  const date = todayISO(options?.now);
  if (!options?.force) {
    const cached = readCachedBrief(date);
    if (cached) {
      return {
        ok: true,
        brief: cached,
        meta: { model: "cache", generatedAt: new Date().toISOString(), contextDate: date },
      };
    }
  }
  const result = await getDailyBrief({ now: options?.now });
  if (result.ok) writeCachedBrief(date, result.brief);
  return result;
}

export function hasShownTuDiaToday(now: Date = new Date()): boolean {
  try {
    return localStorage.getItem(SHOWN_KEY) === todayISO(now);
  } catch {
    return false;
  }
}

export function markTuDiaShownToday(now: Date = new Date()) {
  try {
    localStorage.setItem(SHOWN_KEY, todayISO(now));
  } catch {
    /* silencioso */
  }
}

export function todayISODate(now?: Date): string {
  return todayISO(now);
}
