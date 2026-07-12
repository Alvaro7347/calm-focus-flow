/**
 * ========================================================
 * Archivo: dailyBrief.functions — Daily AI Brief (server)
 *
 * Responsabilidad:
 * Server function que recibe el `DailyContext` (producido por
 * el Daily Context Engine) y solicita al modelo un análisis
 * en JSON estructurado. La IA nunca consulta Supabase: sólo
 * recibe el contexto pre-destilado.
 *
 * Contrato:
 * - Entrada: `DailyContext` completo.
 * - Salida: `DailyBrief` (JSON validado con zod).
 * - Fallo del modelo → devuelve `{ ok: false, error, raw }`
 *   sin romper la aplicación.
 *
 * Reglas del prompt (siempre presentes):
 * - No inventar datos.
 * - No asumir información inexistente.
 * - No cambiar prioridades.
 * - No crear tareas ni modificar proyectos.
 * - Explicar el motivo de cada recomendación.
 * - Ser breve. Tono sereno. Nunca alarmista.
 * ========================================================
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Contratos ----------

const StressLevel = z.enum(["low", "medium", "high", "critical"]);

const DailyBriefSchema = z.object({
  summary: z.string().min(1),
  mainRecommendation: z.string().min(1),
  reason: z.string().min(1),
  alerts: z
    .array(
      z.object({
        title: z.string().min(1),
        detail: z.string().min(1),
        /** Debe corresponderse con `DailyContextAlert.code` cuando aplique. */
        relatedCode: z.string().optional(),
      }),
    )
    .max(10),
  positiveNotes: z.array(z.string().min(1)).max(10),
  stressLevel: StressLevel,
});

export type DailyBrief = z.infer<typeof DailyBriefSchema>;

export interface DailyBriefResultOk {
  ok: true;
  brief: DailyBrief;
  meta: {
    model: string;
    generatedAt: string;
    contextDate: string;
  };
}

export interface DailyBriefResultError {
  ok: false;
  error: string;
  raw?: string;
  meta: {
    model: string;
    generatedAt: string;
    contextDate: string;
  };
}

export type DailyBriefResult = DailyBriefResultOk | DailyBriefResultError;

// ---------- Prompt ----------

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `Eres la voz de CalmApp: una secretaria inteligente, serena y confiable que ya ordenó el caos por el usuario y ahora le muestra por dónde empezar con calma.

Tu trabajo NO es decidir qué es prioritario. La aplicación ya lo decidió con reglas deterministas y te entrega el resultado dentro de "context.today". Tu tarea es REDACTAR con calma, respetando fielmente esa decisión.

## Voz y tono
- Sereno, claro, cercano, breve.
- Sin emojis, sin markdown, sin listas.
- Nunca alarmista ni motivacional. Nada de "productividad", "optimiza", "maximiza".
- No hables como reporte: no listes conteos ni datos técnicos.

## Reglas duras (no romper)
- NO inventes tareas, eventos, horarios, cifras, beneficios ni "ventanas disponibles".
- NO cambies la recomendación entregada por "context.today.recommendation".
- Si "recommendation.kind" es "task" o "event_imminent", "mainRecommendation" DEBE mencionar el título exacto de "recommendation.activity.title" (entre comillas simples).
- Si "recommendation.kind" es "ambiguous", NO elijas una; ofrece decidir entre las alternativas (usa sus títulos exactos).
- Si "recommendation.kind" es "night_review", NO propongas empezar nuevas tareas; sugiere cerrar, revisar o preparar mañana.
- Si "recommendation.kind" es "empty", di simplemente que el día se ve liviano; no generes urgencia artificial.
- "reason" debe apoyarse SOLO en "recommendation.reasonCode" y en datos concretos de "context.today". Prohibidas frases genéricas como "te dará control" o "despejará tu lista".
- "stressLevel" debe reflejar "context.today.load": light→low, moderate→medium, high→high. Nunca "critical" en esta versión.
- Nombra áreas o proyectos por su nombre real solo si aporta claridad; jamás como contexto principal.
- Responde ÚNICAMENTE con el objeto JSON del esquema. Sin texto extra.

## Esquema (no cambiar nombres ni tipos)
{
  "summary": string,               // 1-2 frases. Panorama concreto del día: eventos + tareas relevantes. Sin conteos técnicos.
  "mainRecommendation": string,    // 1 frase. Debe respetar recommendation.
  "reason": string,                // 1-2 frases. Justificación basada en reasonCode + datos reales.
  "alerts": Array<{ "title": string, "detail": string, "relatedCode"?: string }>, // 0-3, opcional.
  "positiveNotes": string[],       // 0-2, opcional. Nunca forzado.
  "stressLevel": "low" | "medium" | "high" | "critical"
}

## Guías por reasonCode
- imminent_event: menciona el próximo compromiso y su hora, invita a prepararse.
- high_overdue: es prioridad alta y viene arrastrada de días anteriores.
- high_today: es prioridad alta programada para hoy.
- high_no_date: es la tarea de prioridad alta pendiente sin fecha.
- medium_overdue: quedó pendiente de días anteriores.
- medium_today: está programada para hoy.
- other_today: es lo relevante programado para hoy.
- multiple_high: hay más de una tarea importante equivalente; invita a elegir.
- night: el día ya casi termina; propone cierre suave.
- empty_day: día liviano, sin compromisos ni prioridades.

## Ejemplos de mainRecommendation
- task/high_today: "Si hoy solo avanzas una cosa, comienza por 'Enviar propuesta a Saint George'."
- event_imminent: "Tu próximo compromiso es 'Reunión UTEM' a las 15:00; puede ser un buen momento para prepararte."
- ambiguous: "Hoy tienes dos tareas importantes: 'Enviar propuesta' y 'Revisar contrato'. Elige con cuál quieres comenzar."
- night_review: "Tu día está terminando. Puedes cerrar lo que quedó abierto o dejarlo listo para mañana."
- empty: "Tu día se ve liviano. No hay compromisos ni tareas prioritarias pendientes."

Recuerda: no debes impresionar, debes ordenar. Redacta sobre lo que ya se decidió.`;

function buildUserPrompt(context: unknown): string {
  return [
    "Este es el contexto ya destilado del día del usuario. Léelo con calma, identifica lo que más ayuda a bajar ruido mental y responde con el JSON del esquema.",
    "",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    "",
    "Recuerda: una sola recomendación principal, tono sereno, sin listar datos como un reporte, sin markdown, solo el objeto JSON.",
  ].join("\n");
}

// ---------- Llamada al modelo ----------

interface GatewayChoice {
  message?: { content?: string };
}
interface GatewayResponse {
  choices?: GatewayChoice[];
  error?: { message?: string };
}

async function callGateway(apiKey: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("rate_limited: el modelo está saturado, reintente en unos minutos.");
    if (res.status === 402) throw new Error("credits_exhausted: agrega créditos al workspace para continuar.");
    throw new Error(`gateway_error ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as GatewayResponse;
  if (data.error?.message) throw new Error(`gateway_error: ${data.error.message}`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty_response: el modelo no devolvió contenido.");
  return content;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // El modelo suele devolver JSON limpio con response_format=json_object,
    // pero como salvaguarda intentamos extraer un objeto delimitado.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// ---------- Server function ----------

/**
 * Genera el brief diario a partir de un `DailyContext` ya construido
 * por el cliente. Requiere sesión: el gasto de créditos se atribuye
 * al usuario autenticado.
 */
export const generateDailyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    // No validamos el shape completo del contexto aquí: es un objeto
    // grande y evolutivo. Sólo garantizamos que sea un objeto.
    if (!input || typeof input !== "object") {
      throw new Error("input must be a DailyContext object");
    }
    return input as Record<string, unknown>;
  })
  .handler(async ({ data }): Promise<DailyBriefResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const meta = {
      model: MODEL,
      generatedAt: new Date().toISOString(),
      contextDate: (data.date as string) ?? "",
    };

    if (!apiKey) {
      return { ok: false, error: "missing_api_key", meta };
    }

    let raw = "";
    try {
      raw = await callGateway(apiKey, buildUserPrompt(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[dailyBrief] gateway call failed:", message);
      return { ok: false, error: message, meta };
    }

    const parsed = tryParseJson(raw);
    if (!parsed) {
      console.error("[dailyBrief] invalid JSON from model:", raw.slice(0, 500));
      return { ok: false, error: "invalid_json", raw, meta };
    }

    const validation = DailyBriefSchema.safeParse(parsed);
    if (!validation.success) {
      console.error("[dailyBrief] schema validation failed:", validation.error.message);
      return {
        ok: false,
        error: `schema_mismatch: ${validation.error.message}`,
        raw,
        meta,
      };
    }

    return { ok: true, brief: validation.data, meta };
  });
