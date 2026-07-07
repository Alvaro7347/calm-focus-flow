/**
 * ========================================================
 * TuDiaScreen — Ritual de apertura de CalmApp.
 *
 * Consume el `DailyBrief` ya generado por la IA (cacheado
 * por día) y lo presenta como una experiencia pausada:
 * saludo, síntesis conversacional, una única recomendación
 * destacada, motivo, estado general y nota positiva opcional.
 *
 * Este componente NO llama al modelo ni modifica servicios.
 * ========================================================
 */
import { useEffect, useState } from "react";
import type { DailyBrief } from "@/services/dailyAiBriefService";

interface Props {
  open: boolean;
  loading: boolean;
  brief: DailyBrief | null;
  error: string | null;
  userName?: string | null;
  onClose: () => void;
}

function saludo(now = new Date()) {
  const h = now.getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLarga(now = new Date()) {
  try {
    const s = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(now);
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return "";
  }
}

function estadoDelDia(level: DailyBrief["stressLevel"] | undefined) {
  switch (level) {
    case "low":
      return { label: "Día tranquilo", tone: "calm" as const };
    case "medium":
      return { label: "Carga moderada", tone: "steady" as const };
    case "high":
    case "critical":
      return { label: "Día exigente", tone: "focus" as const };
    default:
      return null;
  }
}

export function TuDiaScreen({
  open,
  loading,
  brief,
  error,
  userName,
  onClose,
}: Props) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    setClosing(true);
    // Deja correr la animación de "cortina" antes de desmontar.
    window.setTimeout(onClose, 420);
  };

  const nombre = (userName ?? "").trim();
  const estado = estadoDelDia(brief?.stressLevel);
  const positiva =
    brief?.positiveNotes && brief.positiveNotes.length > 0
      ? brief.positiveNotes[0]
      : null;

  return (
    <div
      className={[
        "fixed inset-0 z-50 overflow-y-auto",
        "bg-background",
        closing ? "tudia-closing" : "tudia-opening",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label="Tu día"
    >
      {/* Halo de marca muy sutil: no es un dashboard, es un ritual */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-[0.55]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, color-mix(in oklab, var(--brand-violet) 14%, transparent) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[35vh] h-[45vh] opacity-40"
        style={{
          background:
            "radial-gradient(50% 50% at 70% 30%, color-mix(in oklab, var(--brand-blue) 12%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-xl flex-col px-6 pb-16 pt-14 sm:px-8 md:max-w-2xl md:pt-24">
        {/* Cabecera minimalista: fecha + marca */}
        <div
          className="tudia-reveal flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
          style={{ animationDelay: "40ms" }}
        >
          <span>{fechaLarga()}</span>
          <span className="brand-gradient-text">Tu día</span>
        </div>

        {/* Saludo */}
        <h1
          className="tudia-reveal mt-8 text-[2rem] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-[2.75rem]"
          style={{ animationDelay: "120ms" }}
        >
          {saludo()}
          {nombre ? (
            <>
              ,{" "}
              <span className="brand-gradient-text">{nombre}</span>
            </>
          ) : null}
          .
        </h1>

        {/* Cuerpo */}
        {loading ? (
          <div
            className="tudia-reveal mt-10 space-y-3"
            style={{ animationDelay: "200ms" }}
          >
            <div className="h-3 w-3/4 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted" />
            <p className="pt-4 text-sm text-muted-foreground">
              Preparando tu día con calma…
            </p>
          </div>
        ) : error || !brief ? (
          <div
            className="tudia-reveal mt-10 space-y-2"
            style={{ animationDelay: "200ms" }}
          >
            <p className="text-lg leading-relaxed text-foreground/80">
              Hoy no pudimos preparar tu resumen.
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              Puedes comenzar tu día con normalidad. Tu foco te está esperando.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {/* 1. Síntesis conversacional */}
            <p
              className="tudia-reveal text-xl font-normal leading-[1.55] text-foreground/85 sm:text-[1.375rem]"
              style={{ animationDelay: "220ms" }}
            >
              {brief.summary}
            </p>

            {/* 2. Recomendación única — el corazón de la pantalla */}
            <section
              className="tudia-reveal"
              style={{ animationDelay: "340ms" }}
              aria-labelledby="tudia-reco"
            >
              <p
                id="tudia-reco"
                className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
              >
                Hoy, si solo haces una cosa
              </p>
              <div className="tudia-reco-card mt-4 rounded-3xl bg-card p-6 sm:p-8">
                <p className="text-xl font-medium leading-snug text-foreground sm:text-2xl">
                  {brief.mainRecommendation}
                </p>
                {brief.reason ? (
                  <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                    {brief.reason}
                  </p>
                ) : null}
              </div>
            </section>

            {/* 3. Estado general — chip suave, nunca alarmista */}
            {estado ? (
              <section
                className="tudia-reveal"
                style={{ animationDelay: "460ms" }}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Estado general
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className={`tudia-mood tudia-mood-${estado.tone} inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium`}
                  >
                    <span aria-hidden className="tudia-mood-dot" />
                    {estado.label}
                  </span>
                </div>
              </section>
            ) : null}

            {/* 4. Nota positiva — cierre suave, solo si existe */}
            {positiva ? (
              <section
                className="tudia-reveal"
                style={{ animationDelay: "560ms" }}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Un buen recordatorio
                </p>
                <p className="mt-3 text-[15px] italic leading-relaxed text-foreground/75">
                  “{positiva}”
                </p>
              </section>
            ) : null}
          </div>
        )}

        {/* Botón: inicio del día */}
        <div
          className="tudia-reveal mt-14 flex flex-col items-center gap-3 sm:mt-16"
          style={{ animationDelay: "680ms" }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="tudia-cta group inline-flex w-full max-w-sm items-center justify-center rounded-full px-8 py-4 text-[15px] font-semibold text-white shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--brand-violet)_60%,transparent)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_14px_36px_-12px_color-mix(in_oklab,var(--brand-violet)_70%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--brand-violet)] disabled:opacity-60"
          >
            Comenzar mi día
          </button>
          <p className="text-xs text-muted-foreground">
            Un paso a la vez.
          </p>
        </div>
      </div>

      {/* Estilos locales para el ritual: opening, cortina y tokens de estado */}
      <style>{`
        .tudia-opening { animation: tudia-fade-in 480ms ease-out both; }
        .tudia-closing { animation: tudia-curtain-out 420ms cubic-bezier(0.65, 0, 0.35, 1) both; }
        .tudia-reveal { opacity: 0; animation: tudia-rise 640ms cubic-bezier(0.22, 0.61, 0.36, 1) both; }

        @keyframes tudia-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tudia-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tudia-curtain-out {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-14px); }
        }

        .tudia-cta {
          background: var(--brand-gradient);
          background-size: 160% 100%;
          background-position: 0% 50%;
          transition: background-position 400ms ease, transform 200ms ease, box-shadow 200ms ease;
        }
        .tudia-cta:hover { background-position: 100% 50%; }

        .tudia-reco-card {
          border: 1px solid color-mix(in oklab, var(--brand-violet) 14%, var(--border));
          box-shadow:
            0 1px 0 0 color-mix(in oklab, var(--brand-violet) 6%, transparent) inset,
            0 20px 40px -24px color-mix(in oklab, var(--brand-violet) 30%, transparent);
        }

        .tudia-mood { border: 1px solid var(--border); }
        .tudia-mood-dot {
          width: 6px; height: 6px; border-radius: 999px;
          background: currentColor; opacity: 0.85;
        }
        .tudia-mood-calm {
          color: oklch(0.55 0.09 200);
          background: color-mix(in oklab, oklch(0.55 0.09 200) 10%, var(--card));
          border-color: color-mix(in oklab, oklch(0.55 0.09 200) 22%, var(--border));
        }
        .tudia-mood-steady {
          color: var(--brand-violet);
          background: color-mix(in oklab, var(--brand-violet) 8%, var(--card));
          border-color: color-mix(in oklab, var(--brand-violet) 22%, var(--border));
        }
        .tudia-mood-focus {
          color: oklch(0.55 0.11 60);
          background: color-mix(in oklab, oklch(0.55 0.11 60) 10%, var(--card));
          border-color: color-mix(in oklab, oklch(0.55 0.11 60) 22%, var(--border));
        }

        @media (prefers-reduced-motion: reduce) {
          .tudia-opening, .tudia-closing, .tudia-reveal, .tudia-cta { animation: none !important; transition: none !important; }
          .tudia-reveal { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
