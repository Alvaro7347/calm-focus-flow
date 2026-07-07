/**
 * MicroSurveyPrompt — Card discreta para una única micro-pregunta in-app.
 *
 * Se apoya en `useMicroSurveyGate(placement)` para decidir si debe renderizar.
 * Nunca es un modal a pantalla completa; se integra en el layout existente.
 *
 * Persistencia:
 *  • `recordInAppSurveyResponse` para todas las respuestas.
 *  • `upsertMyResearchProfile` para preguntas de perfil.
 *
 * Privacidad:
 *  • Sólo el `value` de la opción viaja al backend, nunca el texto libre
 *    del usuario, nombre, email, títulos ni descripciones.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useMicroSurveyGate } from "@/hooks/useMicroSurveyGate";
import type { MicroSurveyPlacement } from "@/services/microSurveys";
import { recordInAppSurveyResponse } from "@/services/surveyService";
import { upsertMyResearchProfile } from "@/services/researchProfileService";
import { trackEvent } from "@/services/analyticsService";
import { ANALYTICS_EVENTS } from "@/services/analyticsEvents";
import { useEffect } from "react";

interface Props {
  placement: MicroSurveyPlacement;
  /** Oculta cuando el contexto no admite mostrar preguntas (loading crítico, edición, etc.). */
  disabled?: boolean;
  className?: string;
}

export function MicroSurveyPrompt({ placement, disabled, className }: Props) {
  const gate = useMicroSurveyGate(placement);
  const { question, shouldShow, markShown, markAnswered, markSkipped } = gate;

  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const active = !disabled && shouldShow && !dismissed && !!question;

  useEffect(() => {
    if (active) markShown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active || !question) return null;

  const handleSkip = () => {
    markSkipped();
    setDismissed(true);
  };

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      // 1) Perfil de investigación si aplica.
      if (question.profileField) {
        const res = await upsertMyResearchProfile({
          [question.profileField]: selected,
        });
        if (res.ok) {
          trackEvent(ANALYTICS_EVENTS.RESEARCH_PROFILE_UPDATED, {
            field: question.profileField,
            source: question.source,
          });
        }
      }
      // 2) Registro de respuesta (siempre).
      await recordInAppSurveyResponse({
        surveyKey: question.surveyKey,
        questionKey: question.questionKey,
        answerValue: selected,
        context: { source: question.source },
      });
      markAnswered(selected);
    } catch {
      // silencioso: nunca romper la UI
    } finally {
      setSubmitting(false);
      setDismissed(true);
    }
  };

  return (
    <section
      className={[
        "rounded-xl border border-slate-200 bg-white p-5 md:p-6 space-y-4",
        className ?? "",
      ].join(" ")}
      aria-label={question.title}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
          {question.title}
        </p>
        <p className="text-base font-medium text-slate-900">{question.question}</p>
        <p className="text-xs text-slate-500">Esto nos ayuda a mejorar CalmApp.</p>
      </div>

      <div className="grid gap-2">
        {question.options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              disabled={submitting}
              className={[
                "text-left rounded-lg border px-3 py-2 text-sm transition",
                isSelected
                  ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              ].join(" ")}
              aria-pressed={isSelected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={submitting}
        >
          Ahora no
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!selected || submitting}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Responder
        </Button>
      </div>
    </section>
  );
}
