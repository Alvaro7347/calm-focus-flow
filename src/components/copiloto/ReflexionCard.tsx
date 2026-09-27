/**
 * ========================================================
 * ReflexionCard — Copiloto reflexivo en Tu Día
 *
 * Muestra (como máximo una vez al día) un dato observable y una
 * pregunta abierta. Responder es opcional; la respuesta queda
 * sólo en este dispositivo (ver `copilotService`).
 *
 * Nunca diagnostica ni interpreta: OBSERVAR → EVIDENCIA → PREGUNTAR.
 * ========================================================
 */
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  dismissReflection,
  getTodayReflection,
  saveReflectionAnswer,
  type Reflection,
} from "@/services/copilotService";

export function ReflexionCard({ active }: { active: boolean }) {
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"open" | "saved" | "closed">("open");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getTodayReflection()
      .then((r) => {
        if (!cancelled) setReflection(r);
      })
      .catch(() => {
        // Sin reflexión: Tu Día sigue igual.
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!reflection || state === "closed") return null;

  function guardar() {
    if (!reflection) return;
    if (text.trim()) {
      saveReflectionAnswer(reflection.id, text);
      setState("saved");
    } else {
      dismissReflection(reflection.id);
      setState("closed");
    }
  }

  function ahoraNo() {
    if (!reflection) return;
    dismissReflection(reflection.id);
    setState("closed");
  }

  return (
    <section aria-label="Algo que quizás vale la pena mirar" className="mt-12">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Algo que quizás vale la pena mirar
      </p>
      <div className="mt-4 rounded-3xl border bg-card p-6">
        <p className="text-[15px] leading-relaxed text-foreground/85">{reflection.evidence}</p>
        <p className="mt-3 text-[15px] font-medium leading-relaxed text-foreground">
          {reflection.question}
        </p>

        {state === "saved" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Gracias. Lo verás en tu próxima preparación de semana.
          </p>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Si quieres, escribe lo que aparece. No hay respuestas correctas."
              rows={3}
              className="mt-4 resize-none text-sm"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={ahoraNo}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={guardar}
                className="rounded-full border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                Guardar
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Es una observación a partir de tus datos en CalmApp, no una conclusión. Lo que
              escribas queda solo en este dispositivo.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
