/**
 * ========================================================
 * Archivo: dailyBriefCache
 *
 * Responsabilidad:
 * Cachear el `DailyBrief` generado por la IA una vez por día
 * y por usuario en `localStorage`, y llevar registro de si ya
 * se mostró la pantalla "Tu Día" hoy para ese usuario.
 *
 * Claves usadas (todas por usuario, nunca globales):
 *   - `calmapp.tuDia.brief.{userId}.{YYYY-MM-DD}`  → brief cacheado
 *   - `calmapp.tuDia.shown.{userId}`               → fecha (YYYY-MM-DD)
 *     en la que se mostró Tu Día por última vez a ese usuario.
 *
 * Notas:
 * - Nunca se usa email en la key, sólo `user.id` (auth.uid()).
 * - Las claves globales anteriores (`calmapp.tuDia.shownDate`,
 *   `calmapp.tuDia.brief.{date}`) se ignoran. No se borran para
 *   no tocar otras cachés del navegador.
 * - Si `userId` es null/undefined, las funciones son no-op
 *   seguras (no rompen la app pero tampoco muestran Tu Día
 *   automáticamente).
 * ========================================================
 */
import { getDailyBrief, type DailyBrief, type DailyBriefResult } from "@/services/dailyAiBriefService";

const BRIEF_PREFIX = "calmapp.tuDia.brief.";   // + {userId}.{date}
const SHOWN_PREFIX = "calmapp.tuDia.shown.";   // + {userId}

function todayISO(now: Date = new Date(), timezone?: string): string {
  if (timezone) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return fmt.format(now); // en-CA emits YYYY-MM-DD
    } catch {
      /* fallback local */
    }
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface CachedBrief {
  date: string;
  userId: string;
  brief: DailyBrief;
  savedAt: string;
}

function briefKey(userId: string, date: string) {
  return `${BRIEF_PREFIX}${userId}.${date}`;
}

function shownKey(userId: string) {
  return `${SHOWN_PREFIX}${userId}`;
}

export function readCachedBrief(
  userId: string | null | undefined,
  date?: string,
  timezone?: string,
): DailyBrief | null {
  if (!userId) return null;
  const key = date ?? todayISO(new Date(), timezone);
  try {
    const raw = localStorage.getItem(briefKey(userId, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBrief;
    return parsed.brief ?? null;
  } catch {
    return null;
  }
}

function writeCachedBrief(userId: string, date: string, brief: DailyBrief) {
  try {
    const entry: CachedBrief = {
      date,
      userId,
      brief,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(briefKey(userId, date), JSON.stringify(entry));
    // Limpieza best-effort: borra briefs viejos DE ESTE mismo usuario.
    const keep = briefKey(userId, date);
    const userPrefix = `${BRIEF_PREFIX}${userId}.`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(userPrefix) && k !== keep) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* silencioso */
  }
}

/**
 * Devuelve el brief de hoy del usuario, reutilizando el caché
 * si existe. Sólo invoca a la IA cuando el caché está vacío.
 */
export async function getOrLoadTodayBrief(options?: {
  userId: string | null | undefined;
  force?: boolean;
  now?: Date;
}): Promise<DailyBriefResult> {
  const userId = options?.userId ?? null;
  const date = todayISO(options?.now);
  if (userId && !options?.force) {
    const cached = readCachedBrief(userId, date);
    if (cached) {
      return {
        ok: true,
        brief: cached,
        meta: { model: "cache", generatedAt: new Date().toISOString(), contextDate: date },
      };
    }
  }
  const result = await getDailyBrief({ now: options?.now });
  if (result.ok && userId) writeCachedBrief(userId, date, result.brief);
  return result;
}

/**
 * ¿Ya se le mostró Tu Día hoy a este usuario?
 * Si no hay usuario, devuelve `true` para evitar disparar la
 * pantalla automáticamente sin sesión.
 */
export function hasShownTuDiaToday(
  userId: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!userId) return true;
  try {
    return localStorage.getItem(shownKey(userId)) === todayISO(now);
  } catch {
    return false;
  }
}

export function markTuDiaShownToday(
  userId: string | null | undefined,
  now: Date = new Date(),
) {
  if (!userId) return;
  try {
    localStorage.setItem(shownKey(userId), todayISO(now));
  } catch {
    /* silencioso */
  }
}

export function todayISODate(now?: Date): string {
  return todayISO(now);
}
