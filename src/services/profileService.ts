/**
 * profileService
 * ---------------------------------------------------------------------------
 * ARQUITECTURA
 *
 * Único punto de entrada a la tabla `public.profiles` de Lovable Cloud.
 * La UI (pantalla "Mi Cuenta") NUNCA consulta Supabase directamente:
 *
 *      Pantalla  →  profileService  →  Supabase
 *
 * PREPARACIÓN PARA AUTENTICACIÓN FUTURA
 * Mientras CalmApp no exponga Login, el `user_id` proviene de la sesión de
 * desarrollo (`devAuth.ensureDevSession`). Cuando se incorpore autenticación
 * real, solo cambia la forma de obtener el `user_id`: la pantalla y el resto
 * del servicio no requieren modificaciones.
 */
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  nombre: string | null;
  apellidos: string | null;
  email: string | null;
  avatar_url: string | null;
  timezone: string;
  locale: string;
  /** 0 = domingo, 1 = lunes */
  week_starts_on: 0 | 1;
  date_format: string;
  created_at: string;
  updated_at: string;
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "nombre"
    | "apellidos"
    | "email"
    | "avatar_url"
    | "timezone"
    | "locale"
    | "week_starts_on"
    | "date_format"
  >
>;

/**
 * Devuelve el `user_id` del usuario "activo".
 *
 * Hoy: sesión de desarrollo (single-user). Mañana: sesión autenticada.
 * Aislar esto aquí permite que la pantalla no cambie cuando llegue Login.
 */
async function getActiveUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const userId = await getActiveUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as Profile | null) ?? null;
}

/**
 * Garantiza que el usuario autenticado tenga fila en `profiles`.
 *
 * Flujo:
 *   1. Lee `auth.getUser()` para obtener el usuario actual.
 *   2. Busca el profile por `id`.
 *   3. Si no existe, inserta una fila mínima usando SOLO datos del propio
 *      usuario autenticado (email + metadata). RLS garantiza que jamás se
 *      pueda insertar un profile ajeno.
 *
 * Existe como red de seguridad para casos raros donde el trigger
 * `on_auth_user_created` no se disparó (usuario creado antes del trigger,
 * fallo transitorio, etc.). Idempotente: nunca sobrescribe datos.
 */
export async function ensureCurrentProfile(): Promise<Profile> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userRes.user;
  if (!user) throw new Error("No hay usuario autenticado");

  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as Profile;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nombre =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    null;
  const avatar_url =
    typeof meta.avatar_url === "string" ? meta.avatar_url : null;

  const { data: inserted, error: insErr } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      nombre,
      avatar_url,
      timezone: "America/Santiago",
      locale: "es",
      week_starts_on: 1,
      date_format: "DD/MM/YYYY",
    })
    .select("*")
    .single();

  if (insErr) {
    // Carrera con el trigger: releer.
    const { data: retry, error: retryErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (retryErr) throw retryErr;
    if (retry) return retry as Profile;
    throw insErr;
  }
  return inserted as Profile;
}

export async function updateCurrentProfile(patch: ProfilePatch): Promise<Profile> {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No hay usuario activo");

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Profile;
}
