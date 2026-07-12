/**
 * ========================================================
 * Ruta: /foco
 *
 * Pantalla FOCO. Renderiza las 4 columnas (Hoy, Esta semana,
 * Esperando, Sin movimiento) a partir de los datos entregados
 * por focusService, que a su vez lee EXCLUSIVAMENTE desde
 * Supabase vía taskService.
 *
 * Reactividad:
 * - Los datos se cachean bajo la queryKey ["focus"].
 * - Al crear/editar/completar una tarea, invalidar esa key
 *   con `queryClient.invalidateQueries({ queryKey: ["focus"] })`.
 *   FOCO se refresca automáticamente sin necesidad de recargar.
 *
 * "Tu Día":
 * - La pantalla de bienvenida se muestra una sola vez por día
 *   (estado en `localStorage`). El brief se cachea también por
 *   día, así que la acción "Tu Día" del header lo reabre sin
 *   volver a llamar a la IA.
 * ========================================================
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Clock, Calendar, Hourglass, TrendingUp, Target, Sun } from "lucide-react";

import { FocoColumna } from "@/components/foco/FocoColumna";
import { getFocusTasks } from "@/services/focusService";
import { TuDiaScreen } from "@/components/tuDia/TuDiaScreen";
import {
  getOrLoadTodayBrief,
  hasShownTuDiaToday,
  markTuDiaShownToday,
  readCachedBrief,
} from "@/services/dailyBriefCache";
import { getCurrentProfile } from "@/services/profileService";
import type { DailyBrief } from "@/services/dailyAiBriefService";
import { MicroSurveyPrompt } from "@/components/research/MicroSurveyPrompt";

export const Route = createFileRoute("/foco")({
  head: () => ({
    meta: [
      { title: "FOCO — CalmApp" },
      {
        name: "description",
        content: "Lo que necesita tu foco total. Suelta lo que te pesa y avanza en lo importante.",
      },
    ],
  }),
  component: FocoPage,
});

export const focusQueryKey = ["focus"] as const;

function FocoPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: focusQueryKey,
    queryFn: getFocusTasks,
    staleTime: 15_000,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: getCurrentProfile,
    staleTime: 5 * 60_000,
  });

  // ---------- Tu Día ----------
  const userId = profile?.id ?? null;
  const [tuDiaOpen, setTuDiaOpen] = useState(false);
  const [tuDiaLoading, setTuDiaLoading] = useState(false);
  const [tuDiaBrief, setTuDiaBrief] = useState<DailyBrief | null>(null);
  const [tuDiaError, setTuDiaError] = useState<string | null>(null);
  const autoTriggeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (autoTriggeredFor.current === userId) return;
    autoTriggeredFor.current = userId;
    if (hasShownTuDiaToday(userId)) return;
    setTuDiaOpen(true);
    setTuDiaLoading(true);
    setTuDiaError(null);
    getOrLoadTodayBrief({ userId })
      .then((result) => {
        if (result.ok) setTuDiaBrief(result.brief);
        else setTuDiaError(result.error);
      })
      .catch((e) => setTuDiaError(e instanceof Error ? e.message : String(e)))
      .finally(() => setTuDiaLoading(false));
  }, [userId]);

  // Marcador: el usuario cerró Tu Día en esta sesión → habilita prompt de utilidad.
  const [tuDiaJustClosed, setTuDiaJustClosed] = useState(false);

  const handleCloseTuDia = () => {
    markTuDiaShownToday(userId);
    setTuDiaOpen(false);
    setTuDiaJustClosed(true);
  };

  const handleReopenTuDia = () => {
    // Reabrir: reutiliza el brief ya cacheado del usuario. No llama a la IA.
    const cached = readCachedBrief(userId);
    if (cached) {
      setTuDiaBrief(cached);
      setTuDiaError(null);
      setTuDiaLoading(false);
      setTuDiaOpen(true);
      return;
    }
    // Si no hay caché (raro), intentar cargar sin forzar.
    setTuDiaOpen(true);
    setTuDiaLoading(true);
    setTuDiaError(null);
    getOrLoadTodayBrief({ userId })
      .then((result) => {
        if (result.ok) setTuDiaBrief(result.brief);
        else setTuDiaError(result.error);
      })
      .catch((e) => setTuDiaError(e instanceof Error ? e.message : String(e)))
      .finally(() => setTuDiaLoading(false));
  };


  const hoy = data?.hoy ?? [];
  const semana = data?.estaSemana ?? [];
  const esperando = data?.esperando ?? [];
  const sinMov = data?.sinMovimiento ?? [];

  const [ahaCompletedRemote, setAhaCompletedRemote] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) {
      setAhaCompletedRemote(null);
      return;
    }
    if (hasCompletedFirstAha(userId)) {
      setAhaCompletedRemote(true);
      return;
    }
    let alive = true;
    hasCompletedFirstAhaRemote()
      .then((done) => {
        if (alive) setAhaCompletedRemote(done);
      })
      .catch(() => {
        if (alive) setAhaCompletedRemote(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const showAhaEntry = useMemo(() => {
    if (!userId) return false;
    if (isLoading || isError) return false;
    if (tuDiaOpen) return false;
    if (hasCompletedFirstAha(userId)) return false;
    // Espera la respuesta remota para no parpadear.
    if (ahaCompletedRemote === null) return false;
    return ahaCompletedRemote === false;
  }, [userId, isLoading, isError, tuDiaOpen, ahaCompletedRemote]);


  return (
    <div className="px-6 md:px-10 py-8 pb-32 md:pb-8">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Target className="h-5 w-5" />
            </span>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">FOCO</h1>
          </div>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            Lo que necesita tu foco total. Suelta lo que te pesa y avanza en lo importante.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReopenTuDia}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          aria-label="Volver a ver el resumen de hoy"
          title="Tu Día"
        >
          <Sun className="h-3.5 w-3.5" aria-hidden />
          <span>Tu Día</span>
        </button>
      </div>

      {/* Entrada discreta: Primera descarga mental (Aha Moment) */}
      {showAhaEntry ? (
        <div className="mb-8 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
          <div className="flex items-start gap-4 sm:items-center">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 border border-indigo-100">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                Descarga mental rápida
              </p>
              <p className="text-xs text-slate-600">
                Vacía lo que tienes en la cabeza y CalmApp te ayuda a convertirlo en 3
                próximos pasos.
              </p>
            </div>
            <Link
              to="/primera-descarga"
              className="inline-flex items-center rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
            >
              Empezar descarga
            </Link>
          </div>
        </div>
      ) : null}



      {isLoading ? (
        <div className="text-sm text-slate-500">Cargando tus tareas…</div>
      ) : isError ? (
        <div className="text-sm text-destructive">
          No pudimos cargar tus tareas. {error instanceof Error ? error.message : ""}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <FocoColumna
            numero={1}
            titulo="Hoy"
            subtitulo="Agendado para hoy + todo lo vencido"
            descripcion="Tareas agendadas para hoy, incluyendo lo vencido de días anteriores."
            icono={<Clock className="h-5 w-5" />}
            tareas={hoy}
          />
          <FocoColumna
            numero={2}
            titulo="Esta semana"
            subtitulo="Lo agendado el resto de la semana"
            descripcion="Tareas programadas para el resto de la semana."
            icono={<Calendar className="h-5 w-5" />}
            tareas={semana}
          />
          <FocoColumna
            numero={3}
            titulo="Esperando"
            subtitulo="Tareas en espera o bloqueadas"
            descripcion="Tareas detenidas a la espera de una respuesta o acción externa."
            icono={<Hourglass className="h-5 w-5" />}
            tareas={esperando}
          />
          <FocoColumna
            numero={4}
            titulo="Sin movimiento"
            subtitulo="Tareas sin actividad reciente"
            descripcion="Tareas que llevan varios días sin ningún avance."
            icono={<TrendingUp className="h-5 w-5" />}
            tareas={sinMov}
          />
        </div>
      )}

      {/* Micro-preguntas: sólo aparecen si el gate lo permite y no hay loading crítico. */}
      {!isLoading && !isError && !tuDiaOpen ? (
        <div className="mt-10 mx-auto max-w-2xl space-y-4">
          {tuDiaJustClosed ? (
            <MicroSurveyPrompt placement="after_tu_dia_close" />
          ) : (
            <MicroSurveyPrompt placement="after_focus_review" />
          )}
        </div>
      ) : null}



      {/* Pie */}
      <div className="mt-16 flex flex-col items-center text-center">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden className="text-emerald-400/70">
          <path d="M24 42 C24 30 18 22 10 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M24 42 C24 32 30 24 38 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M14 22 Q12 16 16 12 Q20 16 18 22 Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          <path d="M34 24 Q36 18 32 14 Q28 18 30 24 Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        </svg>
        <p className="mt-3 text-sm font-semibold text-slate-700">Menos ruido, más claridad.</p>
        <p className="text-sm text-slate-500">Enfócate en lo que realmente impulsa tu día.</p>
      </div>

      <TuDiaScreen
        open={tuDiaOpen}
        loading={tuDiaLoading}
        brief={tuDiaBrief}
        error={tuDiaError}
        userName={profile?.nombre ?? null}
        onClose={handleCloseTuDia}
      />
    </div>
  );
}
