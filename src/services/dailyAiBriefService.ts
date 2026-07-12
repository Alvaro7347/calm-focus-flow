/**
 * ========================================================
 * Archivo: dailyAiBriefService — Daily AI Brief (cliente)
 *
 * Responsabilidad:
 * Fachada de cliente para el Agente Inteligente de CalmApp.
 * Orquesta:
 *   1) Consumir `getDailyContext(now, timezone)` (Daily Context Engine).
 *   2) Invocar `generateDailyBrief` (server function) con el
 *      contexto ya priorizado por reglas deterministas.
 *   3) Sobrescribir `stressLevel` para que coincida SIEMPRE con
 *      `context.today.load` (evita contradicciones con el indicador).
 *   4) Si la IA falla, construye un brief determinista de respaldo
 *      a partir de `context.today` para que "Tu Día" nunca quede en
 *      blanco.
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
  at: string;
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
    /* silencioso */
  }
}

export function getDailyBriefLog(): BriefLogEntry[] {
  return readLog();
}

function loadToStress(load: DailyContext["today"]["load"]): DailyBrief["stressLevel"] {
  if (load === "light") return "low";
  if (load === "moderate") return "medium";
  return "high";
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Genera un brief determinista a partir del plan del día. Se usa
 * como fallback si la IA falla, y también para forzar el `summary`
 * cuando la IA devuelve conteos técnicos o texto que contradice el
 * plan.
 */
export function buildFallbackBrief(context: DailyContext): DailyBrief {
  const t = context.today;
  const rec = t.recommendation;

  // Summary concreto y breve.
  const parts: string[] = [];
  if (t.loadCounts.events > 0) {
    parts.push(
      t.loadCounts.events === 1
        ? "hoy tienes un compromiso fijo"
        : `hoy tienes ${t.loadCounts.events} compromisos fijos`,
    );
  }
  const pendings = t.loadCounts.today + t.loadCounts.overdue + t.loadCounts.highNoDate;
  if (pendings > 0) {
    parts.push(
      pendings === 1
        ? "y una tarea pendiente relevante"
        : `y ${pendings} tareas pendientes relevantes`,
    );
  }
  let summary: string;
  if (parts.length === 0) summary = "Tu día se ve liviano. No aparecen compromisos ni tareas prioritarias.";
  else summary = `${parts.join(" ")[0].toUpperCase()}${parts.join(" ").slice(1)}.`;

  // Recomendación + razón.
  let mainRecommendation = "";
  let reason = "";
  switch (rec.kind) {
    case "event_imminent": {
      const a = rec.activity!;
      const h = a.startsAt ? hhmm(a.startsAt) : "";
      mainRecommendation = `Tu próximo compromiso es '${a.title}'${h ? ` a las ${h}` : ""}. Puede ser un buen momento para prepararte.`;
      reason = "Es tu próximo compromiso fijo del día.";
      break;
    }
    case "task": {
      const a = rec.activity!;
      mainRecommendation = `Si hoy solo avanzas una cosa, comienza por '${a.title}'.`;
      const byCode: Record<string, string> = {
        high_overdue: "Es de prioridad alta y viene arrastrada de días anteriores.",
        high_today: "Es de prioridad alta y está programada para hoy.",
        high_no_date: "Es la tarea de prioridad alta pendiente sin fecha.",
        medium_overdue: "Quedó pendiente desde antes.",
        medium_today: "Está programada para hoy.",
        other_today: "Es lo relevante que quedó programado para hoy.",
      };
      reason = byCode[rec.reasonCode] ?? "Es lo más claro para empezar hoy.";
      break;
    }
    case "ambiguous": {
      const alts = (rec.alternatives ?? []).map((a) => `'${a.title}'`).join(" y ");
      mainRecommendation = `Hoy hay más de una tarea importante: ${alts}. Elige con cuál quieres comenzar.`;
      reason = "No aparece una única prioridad dominante para hoy.";
      break;
    }
    case "night_review":
      mainRecommendation = "Tu día está terminando. Puedes cerrar lo que quedó abierto o dejarlo listo para mañana.";
      reason = pendings > 0
        ? `Quedaron ${pendings} tareas pendientes que podrás retomar mañana desde FOCO.`
        : "No es momento de iniciar nuevas tareas.";
      break;
    case "empty":
    default:
      mainRecommendation = "Tu día se ve liviano. Puedes usar este rato para revisar con calma o planificar.";
      reason = "No hay compromisos ni tareas prioritarias pendientes.";
  }

  return {
    summary,
    mainRecommendation,
    reason,
    alerts: [],
    positiveNotes: [],
    stressLevel: loadToStress(t.load),
  };
}

/**
 * Genera el brief del día. Toma opcionalmente un contexto ya
 * construido o una zona horaria (perfil del usuario).
 */
export async function getDailyBrief(options?: {
  context?: DailyContext;
  now?: Date;
  timezone?: string;
}): Promise<DailyBriefResult> {
  const context =
    options?.context ?? (await getDailyContext(options?.now, options?.timezone));

  let result: DailyBriefResult;
  try {
    result = await generateDailyBrief({
      data: context as unknown as Record<string, unknown>,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = {
      ok: false,
      error: message,
      meta: {
        model: "fallback",
        generatedAt: new Date().toISOString(),
        contextDate: context.date,
      },
    };
  }

  const forcedStress = loadToStress(context.today.load);
  const aiError = result.ok ? undefined : result.error;
  if (result.ok) {
    result = {
      ...result,
      brief: { ...result.brief, stressLevel: forcedStress },
    };
  } else {
    result = {
      ok: true,
      brief: buildFallbackBrief(context),
      meta: result.meta,
    };
  }

  appendLog({
    at: new Date().toISOString(),
    contextDate: context.date,
    ok: aiError === undefined,
    error: aiError,
    brief: result.ok ? result.brief : undefined,
  });

  return result;
}
