/**
 * useMicroSurveyGate — decide qué micro-pregunta (si alguna) puede mostrarse
 * en un lugar de la app, aplicando reglas anti-saturación.
 *
 * Reglas:
 *  • Máx. 1 micro-pregunta visible a la vez (una por render por placement).
 *  • Máx. 1 micro-pregunta mostrada por sesión (sessionStorage).
 *  • Máx. 2 micro-preguntas mostradas por semana por usuario (localStorage).
 *  • Preguntas ya respondidas nunca vuelven.
 *  • Preguntas omitidas en esta sesión no vuelven en esta sesión.
 *  • Preguntas de perfil no aparecen si ese campo del perfil ya está seteado.
 *  • Toda clave local se scopea por `user_id` (nunca email).
 */
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MICRO_SURVEY_PLACEMENTS,
  type MicroQuestion,
  type MicroSurveyPlacement,
} from "@/services/microSurveys";
import { getMyResearchProfile } from "@/services/researchProfileService";
import { listMySurveyResponses } from "@/services/surveyService";
import { trackEvent } from "@/services/analyticsService";
import { ANALYTICS_EVENTS } from "@/services/analyticsEvents";
import type { UserResearchProfile, InAppSurveyResponse } from "@/types/analytics";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEK_LIMIT = 2;

function safeSession(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}
function safeLocal(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function sessionShownKey(userId: string) {
  return `calmapp.survey.session.${userId}.shown`;
}
function sessionSkipKey(userId: string, s: string, q: string) {
  return `calmapp.survey.session.${userId}.skipped.${s}.${q}`;
}
function sessionShownSpecificKey(userId: string, s: string, q: string) {
  return `calmapp.survey.session.${userId}.shown.${s}.${q}`;
}
function weekLogKey(userId: string) {
  return `calmapp.survey.weekLog.${userId}`;
}

function readWeekLog(userId: string): number[] {
  const s = safeLocal();
  if (!s) return [];
  try {
    const raw = s.getItem(weekLogKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr.filter((t: unknown) => typeof t === "number" && now - t < WEEK_MS);
  } catch {
    return [];
  }
}

function pushWeekLog(userId: string) {
  const s = safeLocal();
  if (!s) return;
  const next = [...readWeekLog(userId), Date.now()];
  try {
    s.setItem(weekLogKey(userId), JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export interface MicroSurveyGateResult {
  loading: boolean;
  shouldShow: boolean;
  question: MicroQuestion | null;
  markShown: () => void;
  markAnswered: (value: string) => void;
  markSkipped: () => void;
}

export function useMicroSurveyGate(placement: MicroSurveyPlacement): MicroSurveyGateResult {
  const queryClient = useQueryClient();

  const { data: userId, isLoading: loadingUser } = useQuery({
    queryKey: ["auth", "userId"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
    staleTime: 60_000,
  });

  const { data: profile, isLoading: loadingProfile } = useQuery<UserResearchProfile | null>({
    queryKey: ["research_profile", "me"],
    queryFn: getMyResearchProfile,
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { data: responses, isLoading: loadingResponses } = useQuery<InAppSurveyResponse[]>({
    queryKey: ["survey_responses", "me"],
    queryFn: () => listMySurveyResponses(),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const loading = loadingUser || (!!userId && (loadingProfile || loadingResponses));

  const question = useMemo<MicroQuestion | null>(() => {
    if (loading) return null;
    if (!userId) return null;

    const ss = safeSession();
    // Ya se mostró una en esta sesión → no mostrar otra.
    if (ss?.getItem(sessionShownKey(userId))) return null;

    // Límite semanal.
    if (readWeekLog(userId).length >= WEEK_LIMIT) return null;

    const answered = new Set(
      (responses ?? []).map((r) => `${r.survey_key}::${r.question_key}`),
    );

    const candidates = MICRO_SURVEY_PLACEMENTS[placement] ?? [];
    for (const q of candidates) {
      // Ya respondida (en la BD).
      if (answered.has(`${q.surveyKey}::${q.questionKey}`)) continue;

      // Omitida en esta sesión.
      if (ss?.getItem(sessionSkipKey(userId, q.surveyKey, q.questionKey))) continue;

      // Perfil ya seteado.
      if (q.profileField && profile && profile[q.profileField]) continue;

      return q;
    }
    return null;
  }, [loading, userId, placement, profile, responses]);

  const markShown = useCallback(() => {
    if (!userId || !question) return;
    const ss = safeSession();
    const specificKey = sessionShownSpecificKey(userId, question.surveyKey, question.questionKey);
    // Idempotente: si ya se registró en esta sesión, no vuelve a contar.
    if (ss?.getItem(specificKey)) return;
    ss?.setItem(specificKey, "1");
    ss?.setItem(sessionShownKey(userId), "1");
    pushWeekLog(userId);
    trackEvent(ANALYTICS_EVENTS.MICRO_SURVEY_SHOWN, {
      survey_key: question.surveyKey,
      question_key: question.questionKey,
      source: question.source,
    });
  }, [userId, question]);

  const markSkipped = useCallback(() => {
    if (!userId || !question) return;
    const ss = safeSession();
    ss?.setItem(sessionSkipKey(userId, question.surveyKey, question.questionKey), "1");
    trackEvent(ANALYTICS_EVENTS.MICRO_SURVEY_SKIPPED, {
      survey_key: question.surveyKey,
      question_key: question.questionKey,
      source: question.source,
    });
  }, [userId, question]);

  const markAnswered = useCallback(
    (value: string) => {
      if (!userId || !question) return;
      trackEvent(ANALYTICS_EVENTS.MICRO_SURVEY_ANSWERED, {
        survey_key: question.surveyKey,
        question_key: question.questionKey,
        answer_value: value,
        source: question.source,
      });
      // Invalida caches para que la siguiente pantalla no vuelva a mostrar la misma.
      queryClient.invalidateQueries({ queryKey: ["survey_responses", "me"] });
      if (question.profileField) {
        queryClient.invalidateQueries({ queryKey: ["research_profile", "me"] });
      }
    },
    [userId, question, queryClient],
  );

  return {
    loading,
    shouldShow: !loading && !!question,
    question,
    markShown,
    markAnswered,
    markSkipped,
  };
}
