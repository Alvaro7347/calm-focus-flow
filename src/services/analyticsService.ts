/**
 * ==========================================================
 * analyticsService — infraestructura de medición de CalmApp.
 *
 * Regla no negociable:
 * - Nunca romper la UI si esta capa falla.
 * - Nunca registrar datos sensibles (emails, títulos completos
 *   de tareas, teléfonos, tokens, URLs privadas).
 * - Si no hay usuario autenticado, no se registra nada.
 * ==========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { AnalyticsEventName } from "./analyticsEvents";
import type { AnalyticsProperties } from "@/types/analytics";

const IS_DEV = import.meta.env.DEV;

// Claves prohibidas: si alguien intenta enviarlas por accidente,
// se descartan silenciosamente. No es defensa completa contra abuso
// intencional, es un cinturón de seguridad.
const FORBIDDEN_PROPERTY_KEYS = new Set([
  "email",
  "phone",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "task_title",
  "title",
  "description",
  "full_name",
  "name",
]);

function sanitizeProperties(input: Record<string, unknown> | undefined): AnalyticsProperties {
  if (!input) return {};
  const out: AnalyticsProperties = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (FORBIDDEN_PROPERTY_KEYS.has(key.toLowerCase())) {
      if (IS_DEV) console.warn(`[analytics] Propiedad ignorada por privacidad: "${key}"`);
      continue;
    }
    if (value === undefined) continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else {
      // Objetos/arreglos: convertirlos a string acotado para no filtrar cosas raras.
      try {
        const asString = JSON.stringify(value);
        if (asString.length <= 500) out[key] = asString;
      } catch {
        // ignore
      }
    }
  }
  return out;
}

function getCurrentRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return null;
  }
}

// Session id ligero por pestaña (no persistente entre sesiones).
let _sessionId: string | null = null;
function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  if (_sessionId) return _sessionId;
  try {
    const key = "calmapp.analytics.sessionId";
    const existing = window.sessionStorage.getItem(key);
    if (existing) {
      _sessionId = existing;
      return existing;
    }
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, fresh);
    _sessionId = fresh;
    return fresh;
  } catch {
    return null;
  }
}

export interface TrackEventOptions {
  source?: string;
  route?: string | null;
  experimentKey?: string | null;
  experimentVariant?: string | null;
  personaSegment?: string | null;
}

/**
 * Registra un evento de producto. Nunca lanza; nunca bloquea la UI.
 */
export async function trackEvent(
  eventName: AnalyticsEventName,
  properties?: Record<string, unknown>,
  options?: TrackEventOptions,
): Promise<void> {
  if (!eventName || typeof eventName !== "string") return;

  // Fire-and-forget: no bloquea el caller.
  void (async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return; // sin usuario, no medimos

      const payload = {
        user_id: userId,
        event_name: eventName,
        event_properties: sanitizeProperties(properties) as never,
        source: options?.source ?? "app",
        route: options?.route ?? getCurrentRoute(),
        session_id: getSessionId(),
        experiment_key: options?.experimentKey ?? null,
        experiment_variant: options?.experimentVariant ?? null,
        persona_segment: options?.personaSegment ?? null,
      };

      const { error } = await supabase.from("analytics_events").insert(payload);
      if (error && IS_DEV) {
        console.warn("[analytics] trackEvent falló:", error.message);
      }
    } catch (e) {
      if (IS_DEV) console.warn("[analytics] trackEvent error inesperado:", e);
    }
  })();
}
