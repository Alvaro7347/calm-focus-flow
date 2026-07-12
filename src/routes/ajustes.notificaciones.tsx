import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Bell, BellOff, Smartphone, ShieldAlert, CheckCircle2 } from "lucide-react";

import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_PREFS,
  getMyNotificationPrefs,
  updateMyNotificationPrefs,
  type NotificationPrefs,
} from "@/services/notificationPrefsService";
import {
  activatePushOnThisDevice,
  deactivateThisDevice,
  getCurrentDeviceSubscription,
} from "@/services/pushService";
import { getPushCapabilities, type CapabilityInfo } from "@/lib/pushCapabilities";

export const Route = createFileRoute("/ajustes/notificaciones")({
  component: NotificacionesAjustes,
});

function NotificacionesAjustes() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [caps, setCaps] = useState<CapabilityInfo | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<"none" | "active" | "inactive">("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, sub] = await Promise.all([getMyNotificationPrefs(), getCurrentDeviceSubscription()]);
      setPrefs(p);
      setCaps(getPushCapabilities());
      setDeviceStatus(!sub ? "none" : sub.is_active ? "active" : "inactive");
      setLoading(false);
    })();
  }, []);

  async function persist(patch: Partial<NotificationPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      await updateMyNotificationPrefs(patch);
    } catch {
      toast({ title: "No pudimos guardar el cambio.", variant: "destructive" });
      setPrefs(prefs); // rollback
    } finally {
      setSaving(false);
    }
  }

  async function onActivateDevice() {
    setActivating(true);
    const res = await activatePushOnThisDevice();
    setActivating(false);
    setCaps(getPushCapabilities());
    const sub = await getCurrentDeviceSubscription();
    setDeviceStatus(!sub ? "none" : sub.is_active ? "active" : "inactive");
    if (res.ok) {
      toast({ title: "Notificaciones activadas en este dispositivo." });
    } else if (res.reason === "permission_denied") {
      toast({ title: "Permiso rechazado en el navegador.", variant: "destructive" });
    } else if (res.reason === "ios_needs_install") {
      toast({ title: "Agrega CalmApp a tu pantalla de inicio para activar." });
    } else {
      toast({ title: "No pudimos activar las notificaciones.", variant: "destructive" });
    }
  }

  async function onDeactivateDevice() {
    setActivating(true);
    await deactivateThisDevice();
    setActivating(false);
    setDeviceStatus("inactive");
    toast({ title: "Este dispositivo dejó de recibir notificaciones." });
  }

  return (
    <SettingsSubpage title="Notificaciones" description="Cuándo y cómo te avisamos.">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bloque de dispositivo */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Este dispositivo</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-md">
                  Cada dispositivo debe activarse por separado. iPhone, Android y computador reciben sus propios avisos.
                </p>
              </div>
              <DeviceBadge caps={caps} status={deviceStatus} />
            </div>

            <div className="mt-4">
              {caps?.environment === "ios-needs-install" ? (
                <div className="flex items-start gap-2 text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded-lg p-3">
                  <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    En iPhone: abre CalmApp desde el ícono agregado a tu pantalla de inicio para poder activar las notificaciones.
                  </p>
                </div>
              ) : caps?.environment === "denied" ? (
                <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    Notificaciones bloqueadas en el navegador. Actívalas desde los ajustes del dispositivo y vuelve aquí.
                  </p>
                </div>
              ) : caps?.environment === "unsupported" ? (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
                  <BellOff className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Este navegador o dispositivo no admite notificaciones push.</p>
                </div>
              ) : deviceStatus === "active" ? (
                <Button variant="outline" onClick={onDeactivateDevice} disabled={activating}>
                  {activating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}
                  Desactivar este dispositivo
                </Button>
              ) : (
                <Button onClick={onActivateDevice} disabled={activating}>
                  {activating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                  Activar notificaciones aquí
                </Button>
              )}
            </div>
          </section>

          {/* Preferencias generales */}
          <section className="rounded-xl border border-border bg-card divide-y divide-border">
            <PrefRow
              title="Notificaciones"
              description="Interruptor principal. Si lo desactivas, no se envía nada."
              checked={prefs.notifications_enabled}
              onChange={(v) => persist({ notifications_enabled: v })}
              disabled={saving}
            />
            <PrefRow
              title="Eventos importantes"
              description="Aviso 15 minutos antes de eventos de prioridad alta."
              checked={prefs.event_reminders_enabled}
              onChange={(v) => persist({ event_reminders_enabled: v })}
              disabled={saving || !prefs.notifications_enabled}
            />
            <PrefRow
              title="Resumen de tareas importantes"
              description="Un recordatorio consolidado al cierre del día."
              checked={prefs.daily_summary_enabled}
              onChange={(v) => persist({ daily_summary_enabled: v })}
              disabled={saving || !prefs.notifications_enabled}
            />
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Hora del resumen</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Se envía en tu hora local.</p>
              </div>
              <div className="text-sm font-medium text-foreground tabular-nums">
                {String(prefs.daily_summary_hour).padStart(2, "0")}:
                {String(prefs.daily_summary_minute).padStart(2, "0")}
              </div>
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            ¿Necesitas ayuda? Vuelve a la{" "}
            <Link to="/activar-notificaciones" className="underline">
              pantalla de activación
            </Link>
            .
          </p>
        </div>
      )}
    </SettingsSubpage>
  );
}

function PrefRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function DeviceBadge({ caps, status }: { caps: CapabilityInfo | null; status: "none" | "active" | "inactive" }) {
  if (!caps) return null;
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium">
        <CheckCircle2 className="h-3 w-3" /> Activo
      </span>
    );
  }
  if (caps.environment === "unsupported") {
    return (
      <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[11px]">
        No compatible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[11px]">
      Inactivo
    </span>
  );
}
