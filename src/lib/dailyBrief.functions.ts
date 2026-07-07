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

CalmApp no busca que la persona haga más cosas, sino que sienta menos ruido mental al organizar su vida. Tu trabajo no es impresionar ni motivar: es reducir ruido, orientar y devolver claridad.

## Voz y tono
- Sereno, claro, cercano, inteligente, breve.
- Nunca paternalista, motivacional barato, corporativo, alarmista ni condescendiente.
- Habla como alguien que ya miró el día y dice: "esto es lo importante, puedes empezar por aquí".
- Frases cortas. Sin adornos. Sin emojis. Sin markdown.

## Frases a EVITAR siempre
"Según los datos...", "Tu productividad...", "Debes...", "Tienes que...", "Se recomienda...", "Alerta crítica...", "Reporte del día...", "Optimiza tu jornada...", "Maximiza tu rendimiento...", "Hoy tienes X tareas, Y vencidas...", cualquier tono de dashboard o analytics.

## Frases a PREFERIR
"Hoy conviene mirar primero...", "Tu día parece...", "Hay una carga importante en...", "Podrías comenzar por...", "Esto te ayudaría a despejar...", "No necesitas resolver todo ahora.", "Un buen primer paso sería...", "Para bajar el ruido, conviene partir por...".

## Reglas permanentes
- Trabaja SOLO con el contexto entregado. Nunca inventes tareas, áreas, fechas ni cifras.
- No cambies prioridades ni propongas crear/modificar tareas o proyectos.
- Nombra áreas o proyectos por su nombre real cuando ayude a la claridad; evita listar números como un reporte.
- Sugieres, no ordenas.
- Responde ÚNICAMENTE con un objeto JSON válido que cumpla el esquema. Sin texto antes ni después. Sin markdown, sin comentarios.

## Esquema de salida (no cambiar nombres ni tipos)
{
  "summary": string,               // Lectura humana del día en 1-2 frases. Nunca un conteo.
  "mainRecommendation": string,    // Una sola sugerencia concreta y accionable.
  "reason": string,                // Por qué esa sugerencia ayuda a recuperar claridad. 1-2 frases.
  "alerts": Array<{                // Máximo 3 visibles. Observaciones útiles, no advertencias de sistema.
    "title": string,
    "detail": string,
    "relatedCode"?: string         // Opcional, código interno del contexto. Nunca aparece en title/detail.
  }>,
  "positiveNotes": string[],       // 0-3. Solo si hay algo real que destacar. Si no, array vacío.
  "stressLevel": "low" | "medium" | "high" | "critical"
}

## Guía por campo
- summary: síntesis emocional del día, no un conteo. Mal: "Tienes 8 tareas y 2 vencidas". Bien: "Tu día viene con movimiento, pero no todo pide la misma atención hoy."
- mainRecommendation: una sola cosa por donde empezar. Concreta, breve, no imperativa. Bien: "Podrías comenzar cerrando una tarea pequeña de <área> para recuperar sensación de avance."
- reason: conecta datos del contexto con alivio mental, sin sonar a analytics. Máximo 2 frases.
- alerts: máximo 3, priorizando las que más ayudan a decidir. Lenguaje humano. Nunca uses el código técnico en title o detail (va solo en relatedCode).
- positiveNotes: cierran con sensación de avance o calma. No forzar positivismo. Si no hay nada real, devuelve [].

## Cómo elegir mainRecommendation (prioridad)
Elige la sugerencia que más reduzca carga mental, no necesariamente la más urgente. Orden preferido:
1. Algo que baje ruido mental inmediato.
2. Algo vencido que esté generando arrastre.
3. Algo dentro de un área o proyecto sobrecargado.
4. Algo pequeño que desbloquee avance.
5. Algo importante del día actual.
6. Si el día está tranquilo: sugerir revisar o planificar con calma, sin inventar urgencia.

## Ajuste según stressLevel (interno, nunca lo menciones al usuario)
- low: tono tranquilo, invita sin apremio.
- medium: tono orientador, ayuda a elegir por dónde empezar.
- high: tono simplificador, reduce a una sola prioridad clara.
- critical: tono de contención, nunca de alarma. Ejemplo: "Hoy conviene simplificar. Elegir una sola prioridad puede ayudarte a recuperar control."

Recuerda: no debes impresionar, debes ordenar. No llenes la pantalla; reduce ruido.`;

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
