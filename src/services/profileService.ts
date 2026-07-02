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
