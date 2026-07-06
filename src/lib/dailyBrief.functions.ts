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

const SYSTEM_PROMPT = `Eres la asistente ejecutiva de CalmApp. Tu rol es el de una secretaria experta: reduces la carga mental del usuario resumiendo su día con calma y claridad.

Reglas permanentes e innegociables:
- Nunca inventes información. Trabaja SOLO con el contexto entregado.
- Nunca asumas datos que no aparecen en el contexto.
- Nunca cambies prioridades de tareas.
- Nunca crees tareas nuevas ni modifiques proyectos.
- Nunca uses lenguaje alarmista, dramático ni imperativo.
- No ordenas: siempre sugieres.
- Explica SIEMPRE el motivo de cada recomendación citando datos concretos del contexto (números, nombres de áreas o proyectos, fechas).
- Sé breve. Frases cortas. Tono sereno.
- Responde ÚNICAMENTE con un objeto JSON válido que cumpla el esquema indicado. Sin texto antes ni después. Sin markdown.

Esquema de salida:
{
  "summary": string,               // 1-2 frases sobre el estado del día.
  "mainRecommendation": string,    // Una sola sugerencia principal.
  "reason": string,                // Por qué esa recomendación (citando datos).
  "alerts": Array<{                // 0..10 alertas objetivas.
    "title": string,
    "detail": string,
    "relatedCode"?: string         // opcional, código del contexto (ej "overloaded_day").
  }>,
  "positiveNotes": string[],       // 0..10 observaciones positivas.
  "stressLevel": "low" | "medium" | "high" | "critical"
}

Reglas para stressLevel (objetivas, basadas en el contexto):
- "low": pocas tareas para hoy, sin alertas de severidad 3, sin atrasos.
- "medium": alguna alerta severidad 2 o pocas tareas atrasadas.
- "high": varias alertas severidad 2-3 o carga alta.
- "critical": conflictos de horario activos y/o carga muy alta con múltiples atrasos.`;

function buildUserPrompt(context: unknown): string {
  return [
    "Contexto del día (JSON estructurado producido por el motor de contexto):",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    "",
    "Analiza este contexto y devuelve el JSON del esquema. Recuerda: solo JSON, sin markdown, sin texto extra.",
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
      temperature: 0.4,
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
