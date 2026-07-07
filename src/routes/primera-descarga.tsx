/**
 * /primera-descarga — Flujo "Primera descarga mental" (Aha Moment).
 *
 * Máquina de estados simple entre pasos: intro → before → dump → review →
 * next_steps → after → done. Todo lo que se pueda perder al recargar
 * (texto de la descarga) NO se persiste hasta la confirmación explícita.
 *
 * Privacidad:
 *  • Analytics NUNCA recibe títulos ni descripciones.
 *  • activation_cycles solo guarda métricas y escalas 1..5.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MentalLoadStep } from "@/components/aha/MentalLoadStep";
import { BrainDumpStep } from "@/components/aha/BrainDumpStep";
import { ReviewCapturedItemsStep } from "@/components/aha/ReviewCapturedItemsStep";
import { NextStepsStep } from "@/components/aha/NextStepsStep";
import { AfterClarityStep } from "@/components/aha/AfterClarityStep";

import {
  abandonActivationCycle,
  completeActivationCycle,
  createTasksFromConfirmedItems,
  markFirstAhaCompleted,
  parseBrainDumpText,
  startActivationCycle,
  suggestNextSteps,
  type CapturedItem,
  type NextStep,
} from "@/services/ahaService";
import { recordInAppSurveyResponse } from "@/services/surveyService";
import { IN_APP_SURVEY_KEYS, ANALYTICS_EVENTS } from "@/services/analyticsEvents";
import { trackEvent } from "@/services/analyticsService";
import { TASK_INVALIDATION_KEYS } from "@/services/taskService";
import { supabase } from "@/integrations/supabase/client";

type Step = "intro" | "before" | "dump" | "review" | "next_steps" | "after" | "done";

export const Route = createFileRoute("/primera-descarga")({
  head: () => ({
    meta: [
      { title: "Primera descarga mental — CalmApp" },
      {
        name: "description",
        content:
          "Vacía lo que tienes en la cabeza y CalmApp te ayuda a convertirlo en 3 próximos pasos.",
      },
    ],
  }),
  component: PrimeraDescargaPage,
});

function PrimeraDescargaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const [step, setStep] = useState<Step>("intro");
  const [submitting, setSubmitting] = useState(false);

  const [cycleId, setCycleId] = useState<string | null>(null);
  const [mentalBefore, setMentalBefore] = useState<number | null>(null);
  const [mentalAfter, setMentalAfter] = useState<number | null>(null);
  const [items, setItems] = useState<CapturedItem[]>([]);
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);
  const [createdTasksCount, setCreatedTasksCount] = useState(0);

  const finished = useRef(false);
  const startedRef = useRef(false);
  const stepRef = useRef<Step>("intro");
  const cycleIdRef = useRef<string | null>(null);
  const tasksCreatedRef = useRef(false);
  const confirmInProgressRef = useRef(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    cycleIdRef.current = cycleId;
  }, [cycleId]);

  // Registro de abandono si el usuario sale a medio flujo.
  useEffect(() => {
    return () => {
      if (finished.current) return;
      if (!startedRef.current) return;
      const cur = stepRef.current;
      if (cur === "intro" || cur === "done") return;
      const s: Record<Step, string> = {
        intro: "intro",
        before: "before_survey",
        dump: "brain_dump",
        review: "review",
        next_steps: "next_steps",
        after: "after_survey",
        done: "done",
      };
      abandonActivationCycle(cycleIdRef.current, s[cur] ?? "unknown");
    };
  }, []);

  // -------- Handlers --------

  const handleStart = async () => {
    setSubmitting(true);
    const id = await startActivationCycle();
    setCycleId(id);
    trackEvent(ANALYTICS_EVENTS.AHA_FLOW_STARTED, { source: "aha_flow" });
    setSubmitting(false);
    setStep("before");
  };

  const handleSkipFlow = () => {
    trackEvent(ANALYTICS_EVENTS.AHA_FLOW_SKIPPED, { source: "aha_flow" });
    navigate({ to: "/foco" });
  };

  const handleBeforeAnswer = async (value: number) => {
    setMentalBefore(value);
    await recordInAppSurveyResponse({
      surveyKey: IN_APP_SURVEY_KEYS.MENTAL_LOAD_BEFORE,
      questionKey: "before_aha_flow",
      answerNumber: value,
      context: { source: "aha_flow" },
    });
    trackEvent(ANALYTICS_EVENTS.MENTAL_LOAD_SURVEY_ANSWERED, {
      phase: "before",
      source: "aha_flow",
      value,
    });
    setStep("dump");
  };
  const handleBeforeSkip = async () => {
    await recordInAppSurveyResponse({
      surveyKey: IN_APP_SURVEY_KEYS.MENTAL_LOAD_BEFORE,
      questionKey: "before_aha_flow",
      answerValue: "skipped",
      context: { source: "aha_flow" },
    });
    setStep("dump");
  };

  const handleDumpSubmit = (text: string, itemCount: number) => {
    const parsed = parseBrainDumpText(text);
    setItems(parsed);
    trackEvent(ANALYTICS_EVENTS.BRAIN_DUMP_SUBMITTED, {
      item_count: itemCount,
      parsed_count: parsed.length,
      source: "aha_flow",
    });
    setStep("review");
  };

  const handleReviewContinue = () => {
    const confirmed = items.filter((i) => i.confirmed);
    trackEvent(ANALYTICS_EVENTS.CAPTURED_ITEMS_REVIEWED, {
      total_count: items.length,
      confirmed_count: confirmed.length,
      source: "aha_flow",
    });
    const suggested = suggestNextSteps(items);
    setNextSteps(suggested);
    trackEvent(ANALYTICS_EVENTS.NEXT_STEPS_GENERATED, {
      candidate_items_count: confirmed.length,
      next_steps_count: suggested.length,
      source: "aha_flow",
    });
    setStep("next_steps");
  };

  const handleConfirmNextSteps = async () => {
    setSubmitting(true);
    const activeSteps = nextSteps.filter((s) => !s.discarded);
    const editedCount = activeSteps.filter((s) => s.edited).length;
    const discardedCount = nextSteps.length - activeSteps.length;

    trackEvent(ANALYTICS_EVENTS.NEXT_STEPS_CONFIRMED, {
      confirmed_count: activeSteps.length,
      edited_count: editedCount,
      discarded_count: discardedCount,
      source: "aha_flow",
    });

    // Ítems finales a crear: confirmados y no descartados en próximos pasos.
    // Si el usuario editó el título de un próximo paso, se refleja en la tarea.
    const activeStepBySource = new Map(activeSteps.map((s) => [s.sourceItemId, s]));
    const finalItems = items
      .filter((i) => i.confirmed)
      .map((i) => {
        const s = activeStepBySource.get(i.id);
        if (s) return { ...i, title: s.title };
        return i;
      });

    const { createdCount } = await createTasksFromConfirmedItems(finalItems);
    setCreatedTasksCount(createdCount);
    trackEvent(ANALYTICS_EVENTS.AHA_TASKS_CREATED, {
      created_count: createdCount,
      source: "aha_flow",
    });
    // Invalida caches de FOCO/Calendar/Tablero.
    for (const key of TASK_INVALIDATION_KEYS) {
      queryClient.invalidateQueries({ queryKey: [...key] });
    }
    setSubmitting(false);
    setStep("after");
  };

  const handleAfterAnswer = async (value: number) => {
    setMentalAfter(value);
    await recordInAppSurveyResponse({
      surveyKey: IN_APP_SURVEY_KEYS.MENTAL_LOAD_AFTER,
      questionKey: "after_aha_flow",
      answerNumber: value,
      context: { source: "aha_flow" },
    });
    trackEvent(ANALYTICS_EVENTS.MENTAL_LOAD_SURVEY_ANSWERED, {
      phase: "after",
      source: "aha_flow",
      value,
    });

    const activeSteps = nextSteps.filter((s) => !s.discarded);
    const delta = mentalBefore != null ? value - mentalBefore : null;

    await completeActivationCycle(cycleId, {
      dumpedItemsCount: items.length,
      reviewedItemsCount: items.length,
      createdTasksCount,
      nextStepsCount: nextSteps.length,
      confirmedNextStepsCount: activeSteps.length,
      mentalLoadBefore: mentalBefore,
      mentalLoadAfter: value,
    });

    trackEvent(ANALYTICS_EVENTS.AHA_FLOW_COMPLETED, {
      dumped_items_count: items.length,
      created_tasks_count: createdTasksCount,
      confirmed_next_steps_count: activeSteps.length,
      mental_load_delta: delta,
      source: "aha_flow",
    });

    markFirstAhaCompleted(userId);
    finished.current = true;
    setStep("done");
  };

  const summary = useMemo(
    () => ({
      dumpedItemsCount: items.length,
      createdTasksCount,
      confirmedNextStepsCount: nextSteps.filter((s) => !s.discarded).length,
      mentalLoadBefore: mentalBefore,
      mentalLoadAfter: mentalAfter,
      mentalLoadDelta:
        mentalBefore != null && mentalAfter != null ? mentalAfter - mentalBefore : null,
    }),
    [items.length, createdTasksCount, nextSteps, mentalBefore, mentalAfter],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-10 pb-32 md:pb-16">
      <header className="mb-8 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
          Primera descarga mental
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          Bajemos el ruido, con calma.
        </h1>
      </header>

      {step === "intro" ? (
        <section className="space-y-6">
          <p className="text-base leading-relaxed text-slate-700">
            Escribe todo lo que tienes dando vueltas en la cabeza. No tiene que
            estar perfecto. CalmApp te ayudará a ordenarlo y elegir 3 próximos
            pasos.
          </p>
          <p className="text-sm text-slate-500">
            Toma unos minutos. Puedes retomarlo cuando quieras.
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleStart}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Comenzar
            </Button>
            <Button variant="ghost" onClick={handleSkipFlow} disabled={submitting}>
              Ahora no
            </Button>
          </div>
        </section>
      ) : null}

      {step === "before" ? (
        <MentalLoadStep
          phase="before"
          question="Antes de partir, ¿cuánta carga mental sientes ahora?"
          onAnswer={handleBeforeAnswer}
          onSkip={handleBeforeSkip}
          submitting={submitting}
        />
      ) : null}

      {step === "dump" ? (
        <BrainDumpStep
          onSubmit={handleDumpSubmit}
          onBack={() => setStep("before")}
          submitting={submitting}
        />
      ) : null}

      {step === "review" ? (
        <ReviewCapturedItemsStep
          items={items}
          onChange={setItems}
          onContinue={handleReviewContinue}
          onBack={() => setStep("dump")}
          submitting={submitting}
        />
      ) : null}

      {step === "next_steps" ? (
        <NextStepsStep
          steps={nextSteps}
          onChange={setNextSteps}
          onConfirm={handleConfirmNextSteps}
          onBack={() => setStep("review")}
          submitting={submitting}
        />
      ) : null}

      {step === "after" ? (
        <MentalLoadStep
          phase="after"
          question="Después de ordenar esta descarga, ¿cuánta carga mental sientes ahora?"
          onAnswer={handleAfterAnswer}
          submitting={submitting}
        />
      ) : null}

      {step === "done" ? (
        <AfterClarityStep
          summary={summary}
          onGoFoco={() => navigate({ to: "/foco" })}
        />
      ) : null}
    </div>
  );
}
