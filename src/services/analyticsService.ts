/**
 * ==========================================================
 * analyticsService — infraestructura de medición de CalmApp.
 *
 * Regla no negociable:
 * - Nunca romper la UI si esta capa falla.
 * - Nunca registrar datos sensibles.
 * - Solo primitivos (string/number/boolean/null). Objetos y
 *   arreglos se descartan por completo.
 * - Si no hay usuario autenticado, no se registra nada.
 * ==========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import type { AnalyticsEventName } from "./analyticsEvents";
import type { AnalyticsProperties } from "@/types/analytics";

const IS_DEV = import.meta.env.DEV;

// Fragmentos prohibidos: se rechaza cualquier key cuyo nombre
// (normalizado) contenga alguno de estos fragmentos. Coincidencia
// parcial, no exacta.
const FORBIDDEN_KEY_FRAGMENTS = [
  "email",
  "phone",
  "token",
  "password",
  "secret",
  "title",
  "description",
  "name",
  "content",
  "note",
  "calendar",
  "url",
  "address",
  "medical",
  "health",
  "child",
  "rut",
  "dni",
  "task",
  "message",
  "body",
  "text",
];

function isKeyForbidden(rawKey: string): boolean {
  const key = rawKey.toLowerCase();
  return FORBIDDEN_KEY_FRAGMENTS.some((fragment) => key.includes(fragment));
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function sanitizeProperties(
  input: Record<string, unknown> | undefined,
): AnalyticsProperties {
  if (!input || typeof input !== "object") return {};
  const out: AnalyticsProperties = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (isKeyForbidden(key)) {
      if (IS_DEV) console.warn(`[analytics] Propiedad ignorada por privacidad: "${key}"`);
      continue;
    }
    if (value === undefined) continue;
    if (!isPrimitive(value)) {
      if (IS_DEV) {
        console.warn(
          `[analytics] Propiedad ignorada (no primitiva): "${key}". ` +
            "Envía solo booleans/números/strings cortos; nunca objetos ni arrays.",
        );
      }
      continue;
    }
    // Acotar strings para no filtrar contenido largo por accidente.
    if (typeof value === "string" && value.length > 120) {
      if (IS_DEV) console.warn(`[analytics] Propiedad ignorada (string > 120): "${key}"`);
      continue;
    }
    out[key] = value;
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
