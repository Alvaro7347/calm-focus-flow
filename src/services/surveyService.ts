/**
 * surveyService — micro-preguntas dentro de la app.
 * No crea UI. Solo persiste respuestas asociadas a auth.uid().
 *
 * `context` se sanitiza con las mismas reglas que analytics:
 * solo primitivos y sin claves sensibles. Para texto libre usar
 * `answerText`, y NUNCA con contenido sensible (email, títulos,
 * descripciones, notas privadas, datos clínicos, teléfonos,
 * URLs privadas, contenido de calendario).
 */
import { supabase } from "@/integrations/supabase/client";
import type { InAppSurveyKey } from "./analyticsEvents";
import type { InAppSurveyResponse } from "@/types/analytics";
import { sanitizeProperties } from "./analyticsService";

const IS_DEV = import.meta.env.DEV;

export interface RecordSurveyResponseInput {
  surveyKey: InAppSurveyKey;
  questionKey: string;
  answerValue?: string | null;
  answerNumber?: number | null;
  /**
   * Texto libre. Usar con moderación; nunca para contenido sensible.
   */
  answerText?: string | null;
  context?: Record<string, unknown>;
  route?: string | null;
}

function getCurrentRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.location.pathname;
  } catch {
    return null;
  }
}

/**
 * Registra una respuesta a una micro-encuesta in-app.
 * No lanza; no bloquea la UI.
 */
export async function recordInAppSurveyResponse(
  input: RecordSurveyResponseInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!input.surveyKey || !input.questionKey) {
      return { ok: false, error: "surveyKey y questionKey son requeridos" };
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return { ok: false, error: "no_auth" };

    const safeContext = sanitizeProperties(input.context);

    const { error } = await supabase.from("in_app_survey_responses").insert({
      user_id: userId,
      survey_key: input.surveyKey,
      question_key: input.questionKey,
      answer_value: input.answerValue ?? null,
      answer_number: input.answerNumber ?? null,
      answer_text: input.answerText ?? null,
      context: safeContext as never,
      route: input.route ?? getCurrentRoute(),
    });
    if (error) {
      if (IS_DEV) console.warn("[survey] insert falló:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (IS_DEV) console.warn("[survey] error inesperado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Lee las respuestas del usuario actual (RLS filtra por auth.uid()).
 */
export async function listMySurveyResponses(surveyKey?: string): Promise<InAppSurveyResponse[]> {
  let query = supabase
    .from("in_app_survey_responses")
    .select("*")
    .order("created_at", { ascending: false });
  if (surveyKey) query = query.eq("survey_key", surveyKey);
  const { data, error } = await query;
  if (error) {
    if (IS_DEV) console.warn("[survey] list falló:", error.message);
    return [];
  }
  return (data ?? []) as InAppSurveyResponse[];
}
