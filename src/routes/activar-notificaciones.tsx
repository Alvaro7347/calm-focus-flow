import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, ShieldAlert, Smartphone, Loader2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoSymbol } from "@/components/brand/LogoSymbol";
import { activatePushOnThisDevice } from "@/services/pushService";
import { getPushCapabilities, type CapabilityInfo } from "@/lib/pushCapabilities";

export const Route = createFileRoute("/activar-notificaciones")({
  head: () => ({
    meta: [
      { title: "Activar notificaciones — CalmApp" },
      { name: "description", content: "Recibe avisos de tus compromisos importantes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivarNotificacionesPage,
});

type UiState = "idle" | "loading" | "granted" | "error";

function ActivarNotificacionesPage() {
  const navigate = useNavigate();
  const [caps, setCaps] = useState<CapabilityInfo | null>(null);
  const [state, setState] = useState<UiState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCaps(getPushCapabilities());
  }, []);

  async function onActivate() {
    setError(null);
    setState("loading");
    const res = await activatePushOnThisDevice();
    if (res.ok) {
      setState("granted");
      setCaps(getPushCapabilities());
      return;
    }
    setState("error");
    setCaps(getPushCapabilities());
    switch (res.reason) {
      case "permission_denied":
        setError(
          "Rechazaste el permiso. Puedes activarlo más tarde desde los ajustes de tu dispositivo, en la sección de notificaciones de tu navegador o de CalmApp.",
        );
        break;
      case "ios_needs_install":
        setError(
          "Para recibir notificaciones en iPhone, primero agrega CalmApp a tu pantalla de inicio y ábrela desde ese ícono.",
        );
        break;
      case "unsupported":
        setError("Este navegador o dispositivo no admite notificaciones push.");
        break;
      case "no_user":
        setError("Debes iniciar sesión antes de activar las notificaciones.");
        break;
      case "sw_failed":
      case "subscribe_failed":
        setError("No pudimos completar la suscripción. Intenta de nuevo en unos minutos.");
        break;
      default:
        setError("Ocurrió un problema inesperado.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex flex-col">
      <header className="p-4">
        <Link to="/foco" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Ir a CalmApp
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center">
            <LogoSymbol size={72} opacity={0.95} ariaHidden />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
              Mantente al tanto de tus compromisos importantes
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              CalmApp puede avisarte antes de tus eventos importantes y recordarte
              las tareas prioritarias antes de terminar el día.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <FeatureRow
              icon={<Bell className="h-5 w-5" />}
              title="Eventos importantes"
              body="Un aviso 15 minutos antes de que empiece un evento marcado como prioridad alta."
            />
            <FeatureRow
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Resumen diario"
              body="A las 18:00 en tu hora local, un recordatorio de tus tareas importantes pendientes."
            />
          </div>

          <div className="mt-8">
            <StateBlock caps={caps} state={state} error={error} />
          </div>

          <div className="mt-6 space-y-2">
            {caps?.environment === "granted" || state === "granted" ? (
              <>
                <Button className="w-full" onClick={() => navigate({ to: "/foco" })}>
                  Ir a mi día
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate({ to: "/ajustes/notificaciones" })}
                >
                  Gestionar notificaciones
                </Button>
              </>
            ) : caps?.environment === "denied" ? (
              <Button variant="secondary" className="w-full" onClick={() => navigate({ to: "/foco" })}>
                Continuar sin notificaciones
              </Button>
            ) : caps?.environment === "ios-needs-install" ? (
              <Button variant="secondary" className="w-full" onClick={() => navigate({ to: "/foco" })}>
                Entendido, continuar
              </Button>
            ) : caps?.environment === "unsupported" ? (
              <Button variant="secondary" className="w-full" onClick={() => navigate({ to: "/foco" })}>
                Continuar
              </Button>
            ) : (
              <>
                <Button
                  className="w-full"
                  onClick={onActivate}
                  disabled={state === "loading"}
                >
                  {state === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activando…
                    </>
                  ) : (
                    <>
                      <Bell className="mr-2 h-4 w-4" />
                      Activar notificaciones
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate({ to: "/foco" })}
                  disabled={state === "loading"}
                >
                  Ahora no
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function StateBlock({
  caps,
  state,
  error,
}: {
  caps: CapabilityInfo | null;
  state: UiState;
  error: string | null;
}) {
  if (!caps) return null;

  if (state === "granted" || caps.environment === "granted") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Notificaciones activadas en este dispositivo.</p>
          <p className="mt-1 text-emerald-700/90">
            Recibirás avisos aunque CalmApp no esté abierta. Si usas más dispositivos, actívalas en cada uno.
          </p>
        </div>
      </div>
    );
  }

  if (caps.environment === "denied") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Notificaciones bloqueadas.</p>
          <p className="mt-1 text-amber-800/90">
            Para activarlas, abre los ajustes de tu dispositivo o navegador y permite las notificaciones de CalmApp. Luego vuelve a esta pantalla.
          </p>
        </div>
      </div>
    );
  }

  if (caps.environment === "ios-needs-install") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <Smartphone className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">En iPhone: agrega CalmApp a tu pantalla de inicio.</p>
          <p className="mt-1 text-sky-800/90">
            En Safari, pulsa el ícono de compartir y elige "Agregar a pantalla de inicio". Abre CalmApp desde ese ícono y vuelve aquí para activar las notificaciones.
          </p>
        </div>
      </div>
    );
  }

  if (caps.environment === "unsupported") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <BellOff className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">Este dispositivo no admite notificaciones push.</p>
          <p className="mt-1">
            Puedes seguir usando CalmApp normalmente. En un dispositivo compatible, esta pantalla te dejará activarlas.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error" && error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return null;
}
