/**
 * ========================================================
 * TuDiaScreen
 *
 * Pantalla de bienvenida diaria de CalmApp. Consume el
 * `DailyBrief` generado por la IA (ya cacheado por día) y lo
 * presenta con una tipografía tranquila, sin tarjetas ni
 * colores llamativos.
 *
 * Este componente NO llama al modelo: recibe el resultado
 * ya obtenido (o `null` si aún se está cargando / falló).
 * ========================================================
 */
import { useEffect, useState } from "react";
import { Sun } from "lucide-react";
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

export function TuDiaScreen({ open, loading, brief, error, userName, onClose }: Props) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    setClosing(true);
    // Pequeña espera para dejar correr el fade-out.
    window.setTimeout(onClose, 220);
  };

  const nombre = (userName ?? "").trim();

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-white ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Tu día"
    >
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-6 py-14 md:py-20">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
            <Sun className="h-3.5 w-3.5" aria-hidden />
            <span>Tu día</span>
          </div>
          <h1 className="mt-4 text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
            {saludo()}{nombre ? `, ${nombre}` : ""}.
          </h1>
        </header>

        {loading ? (
          <p className="text-slate-500 text-base leading-relaxed">
            Preparando el resumen de tu día…
          </p>
        ) : error || !brief ? (
          <p className="text-slate-500 text-base leading-relaxed">
            Hoy no fue posible generar el resumen del día. Puedes continuar con tu foco con normalidad.
          </p>
        ) : (
          <div className="space-y-10 text-slate-700">
            <p className="text-lg leading-relaxed text-slate-800">{brief.summary}</p>

            <section>
              <hr className="mb-6 border-slate-100" />
              <h2 className="text-xs uppercase tracking-widest text-slate-400 mb-3">
                Recomendación principal
              </h2>
              <p className="text-base leading-relaxed text-slate-800">
                {brief.mainRecommendation}
              </p>
              {brief.reason ? (
                <>
                  <p className="mt-6 text-xs uppercase tracking-widest text-slate-400 mb-2">
                    ¿Por qué?
                  </p>
                  <p className="text-sm leading-relaxed text-slate-600">{brief.reason}</p>
                </>
              ) : null}
            </section>

            {brief.alerts && brief.alerts.length > 0 ? (
              <section>
                <hr className="mb-6 border-slate-100" />
                <h2 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Alertas</h2>
                <ul className="space-y-3">
                  {brief.alerts.map((a, i) => (
                    <li key={i} className="text-sm leading-relaxed">
                      <span className="text-slate-800 font-medium">{a.title}.</span>{" "}
                      <span className="text-slate-600">{a.detail}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {brief.positiveNotes && brief.positiveNotes.length > 0 ? (
              <section>
                <hr className="mb-6 border-slate-100" />
                <h2 className="text-xs uppercase tracking-widest text-slate-400 mb-3">
                  Aspecto positivo
                </h2>
                <ul className="space-y-2">
                  {brief.positiveNotes.map((n, i) => (
                    <li key={i} className="text-sm leading-relaxed text-slate-600">
                      {n}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        <div className="mt-12 pt-6">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-60"
            disabled={loading}
          >
            Comenzar mi día
          </button>
        </div>
      </div>
    </div>
  );
}
