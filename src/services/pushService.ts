/**
 * ========================================================
 * pushService
 *
 * Gestiona el ciclo de vida de la suscripción Web Push del
 * dispositivo actual: registrar el service worker, solicitar
 * el permiso (siempre tras acción explícita del usuario),
 * generar la PushSubscription y almacenarla en Supabase con
 * RLS. También se encarga de sincronizar la zona horaria del
 * perfil cuando cambia.
 *
 * Reglas:
 *  - No registra el SW en previews de Lovable (iframe).
 *  - No solicita permiso al importar el módulo.
 *  - La clave pública VAPID se obtiene desde el server via
 *    `getVapidPublicKey()` (sin exponer la privada).
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import { getVapidPublicKey } from "@/lib/pushVapid.functions";
import { detectTimezone, getOrCreateDeviceId, getPushCapabilities } from "@/lib/pushCapabilities";

const SW_PATH = "/sw.js";

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com")
  );
}

function inIframe(): boolean {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
}

/** Registra el service worker (si el entorno lo permite). */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (inIframe()) return null; // Nunca registrar dentro del preview embebido.

  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface ActivationResult {
  ok: boolean;
  reason?:
    | "permission_denied"
    | "unsupported"
    | "ios_needs_install"
    | "no_user"
    | "sw_failed"
    | "subscribe_failed";
  subscriptionId?: string;
}

/** Sincroniza la zona horaria detectada con la del perfil. */
export async function syncTimezoneWithProfile(): Promise<void> {
  const tz = detectTimezone();
  if (!tz) return;
  const { data: sess } = await supabase.auth.getUser();
  if (!sess.user) return;
  const { data: prof } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", sess.user.id)
    .maybeSingle();
  if (prof && prof.timezone !== tz) {
    await supabase.from("profiles").update({ timezone: tz }).eq("id", sess.user.id);
  }
}

/**
 * Flujo completo de activación. DEBE llamarse desde el onClick del
 * botón "Activar notificaciones" — no automáticamente al montar.
 */
export async function activatePushOnThisDevice(): Promise<ActivationResult> {
  const caps = getPushCapabilities();
  if (caps.environment === "unsupported") return { ok: false, reason: "unsupported" };
  if (caps.environment === "ios-needs-install") return { ok: false, reason: "ios_needs_install" };

  const { data: sess } = await supabase.auth.getUser();
  if (!sess.user) return { ok: false, reason: "no_user" };

  // 1. Permiso nativo (solo tras clic).
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission_denied" };

  // 2. Service worker.
  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "sw_failed" };

  // 3-6. Suscripción push (clave VAPID desde el server), guardado en
  // Supabase y sincronización de TZ.
  const result = await subscribeAndPersist(reg, sess.user.id);
  if (!result) return { ok: false, reason: "subscribe_failed" };

  // El usuario volvió a activar: deja de estar en "opt-out".
  setOptOut(false);

  return { ok: true, subscriptionId: result.id };
}

// ------------------------------------------------------------
// Helpers compartidos (activación manual y reparación silenciosa)
// ------------------------------------------------------------

const OPT_OUT_KEY = "calmapp.push_opt_out";

/** Marca local: el usuario desactivó a propósito este dispositivo. */
function setOptOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // ignore (modo privado, almacenamiento bloqueado)
  }
}

function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Crea una PushSubscription nueva (requiere permiso ya concedido). */
async function createPushSubscription(
  reg: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  try {
    const vapidPub = await getVapidPublicKey();
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPub).buffer as ArrayBuffer,
    });
  } catch (err) {
    console.error("[push] subscribe failed", err);
    return null;
  }
}

/**
 * Upsert por endpoint (único) en `push_subscriptions` y marca la fila como
 * activa. RLS aplica: solo el propio usuario. Devuelve el id o null.
 */
async function persistSubscription(
  subscription: PushSubscription,
  userId: string,
): Promise<string | null> {
  const p256dh = arrayBufferToBase64Url(subscription.getKey("p256dh"));
  const authKey = arrayBufferToBase64Url(subscription.getKey("auth"));
  const endpoint = subscription.endpoint;
  const deviceId = getOrCreateDeviceId();
  const tz = detectTimezone();

  const { data: existing } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();

  let subscriptionId: string;
  if (existing) {
    subscriptionId = existing.id;
    const { error } = await supabase
      .from("push_subscriptions")
      .update({
        user_id: userId,
        p256dh,
        auth_key: authKey,
        device_id: deviceId,
        user_agent: navigator.userAgent.slice(0, 200),
        platform: navigator.platform?.slice(0, 60) ?? null,
        timezone: tz,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        deactivated_at: null,
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[push] update failed", error);
      return null;
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("push_subscriptions")
      .insert({
        user_id: userId,
        endpoint,
        p256dh,
        auth_key: authKey,
        device_id: deviceId,
        user_agent: navigator.userAgent.slice(0, 200),
        platform: navigator.platform?.slice(0, 60) ?? null,
        timezone: tz,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      console.error("[push] insert failed", error);
      return null;
    }
    subscriptionId = inserted.id;
  }

  // Sincronizar TZ del perfil (silencioso).
  await syncTimezoneWithProfile().catch(() => {});
  return subscriptionId;
}

/**
 * Reutiliza la suscripción local si sigue viva; si falta, o si el servidor
 * la marcó como expirada (Apple/Google respondió 404/410), crea una nueva.
 * Luego la guarda en Supabase.
 */
async function subscribeAndPersist(
  reg: ServiceWorkerRegistration,
  userId: string,
): Promise<{ id: string; outcome: "healthy" | "registered" | "renewed" } | null> {
  let subscription = await reg.pushManager.getSubscription();
  let outcome: "healthy" | "registered" | "renewed" = "registered";

  if (subscription) {
    const { data: row } = await supabase
      .from("push_subscriptions")
      .select("id, is_active")
      .eq("endpoint", subscription.endpoint)
      .maybeSingle();
    if (row?.is_active) {
      outcome = "healthy";
    } else if (row) {
      // Endpoint muerto: descartarlo para obtener uno nuevo.
      try {
        await subscription.unsubscribe();
      } catch {
        // ignore
      }
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await createPushSubscription(reg);
    if (!subscription) return null;
    outcome = "renewed";
  }

  const id = await persistSubscription(subscription, userId);
  return id ? { id, outcome } : null;
}

export type PushRepairResult =
  | "skipped" // sin permiso, sin soporte, preview, opt-out o sin sesión
  | "healthy" // la suscripción seguía activa
  | "registered" // la fila faltaba o estaba inactiva: se volvió a guardar
  | "renewed" // la suscripción había expirado: se creó una nueva
  | "failed";

let repairInFlight: Promise<PushRepairResult> | null = null;
let lastRepairAt = 0;
/** Como mucho una revisión por hora (la app puede volver a primer plano a menudo). */
const REPAIR_MIN_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Reparación silenciosa de la suscripción push del dispositivo.
 *
 * Se llama al abrir la app con sesión iniciada. iOS (y a veces Android)
 * invalida suscripciones sin avisar —tras actualizar el sistema, reinstalar
 * el ícono o limpiar datos—; el servidor recibe 410 y la desactiva, y el
 * usuario deja de recibir avisos sin enterarse. Esta función:
 *  - No pide permiso nunca: solo actúa si el permiso YA está concedido.
 *  - Respeta la desactivación manual (marca local de opt-out).
 *  - Si la suscripción local falta, o el servidor la marcó como expirada,
 *    crea una nueva y la registra. Si sigue sana, actualiza last_seen_at.
 */
export function repairPushSubscriptionSilently(): Promise<PushRepairResult> {
  if (repairInFlight) return repairInFlight;
  if (Date.now() - lastRepairAt < REPAIR_MIN_INTERVAL_MS) return Promise.resolve("skipped");
  lastRepairAt = Date.now();
  repairInFlight = doRepair()
    .catch((err) => {
      console.warn("[push] repair failed", err);
      return "failed" as const;
    })
    .finally(() => {
      repairInFlight = null;
    });
  return repairInFlight;
}

async function doRepair(): Promise<PushRepairResult> {
  if (isPreviewHost() || inIframe()) return "skipped";
  if (getPushCapabilities().environment !== "granted") return "skipped";
  if (isOptedOut()) return "skipped";

  const { data: sess } = await supabase.auth.getUser();
  if (!sess.user) return "skipped";

  const reg = await ensureServiceWorker();
  if (!reg) return "skipped";

  const result = await subscribeAndPersist(reg, sess.user.id);
  return result ? result.outcome : "failed";
}
/** Desactiva la suscripción del dispositivo actual (no borra el registro). */
export async function deactivateThisDevice(): Promise<void> {
  // Recordar la decisión para que la reparación silenciosa no reactive.
  setOptOut(true);
  const reg =
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration(SW_PATH)
      : null;
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq("endpoint", endpoint);
      try {
        await sub.unsubscribe();
      } catch {
        // ignore
      }
    }
  }
}

/** Devuelve la suscripción activa del dispositivo actual (si existe). */
export async function getCurrentDeviceSubscription(): Promise<{
  id: string;
  is_active: boolean;
  last_seen_at: string;
} | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, is_active, last_seen_at")
    .eq("endpoint", sub.endpoint)
    .maybeSingle();
  return data ?? null;
}
