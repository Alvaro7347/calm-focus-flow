/**
 * ========================================================
 * pushCapabilities
 *
 * Detección de capacidades del dispositivo para Web Push.
 * Es puramente lectura y no solicita el permiso del sistema.
 * La solicitud nativa DEBE ejecutarse solo después de una
 * interacción explícita del usuario (botón "Activar
 * notificaciones").
 * ========================================================
 */

export type PushEnvironment =
  | "unsupported"          // Navegador o dispositivo sin Web Push
  | "ios-needs-install"    // iOS/iPadOS Safari que aún no está instalado como PWA
  | "ready"                // Todo disponible, falta solicitar permiso
  | "granted"              // Permiso concedido
  | "denied";              // Permiso rechazado (requiere acción del sistema)

export interface CapabilityInfo {
  environment: PushEnvironment;
  isStandalone: boolean;
  isIos: boolean;
  supportsServiceWorker: boolean;
  supportsPushManager: boolean;
  supportsNotification: boolean;
  permission: NotificationPermission | "unsupported";
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIPad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
  return /iPhone|iPod/.test(ua) || isIPad;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  // Safari iOS expone navigator.standalone en modo instalado.
  // deno-lint-ignore no-explicit-any
  const iosStandalone = (window.navigator as any).standalone === true;
  return mm || iosStandalone;
}

export function getPushCapabilities(): CapabilityInfo {
  if (typeof window === "undefined") {
    return {
      environment: "unsupported",
      isStandalone: false,
      isIos: false,
      supportsServiceWorker: false,
      supportsPushManager: false,
      supportsNotification: false,
      permission: "unsupported",
    };
  }
  const supportsServiceWorker = "serviceWorker" in navigator;
  const supportsPushManager = "PushManager" in window;
  const supportsNotification = "Notification" in window;
  const isIos = detectIos();
  const isStandalone = detectStandalone();

  const permission: NotificationPermission | "unsupported" = supportsNotification
    ? Notification.permission
    : "unsupported";

  let environment: PushEnvironment;
  if (!supportsServiceWorker || !supportsPushManager || !supportsNotification) {
    // iOS Safari solo expone PushManager en modo instalado; distinguimos ese caso.
    environment = isIos && !isStandalone ? "ios-needs-install" : "unsupported";
  } else if (isIos && !isStandalone) {
    environment = "ios-needs-install";
  } else if (permission === "granted") {
    environment = "granted";
  } else if (permission === "denied") {
    environment = "denied";
  } else {
    environment = "ready";
  }

  return {
    environment,
    isStandalone,
    isIos,
    supportsServiceWorker,
    supportsPushManager,
    supportsNotification,
    permission,
  };
}

/** Zona horaria IANA detectada por el navegador, o null si no está disponible. */
export function detectTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && typeof tz === "string" ? tz : null;
  } catch {
    return null;
  }
}

/** Identificador local persistente del dispositivo (no PII). */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const key = "calmapp.device_id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
