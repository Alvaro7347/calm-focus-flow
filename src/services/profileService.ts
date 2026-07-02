/**
 * profileService
 * ---------------------------------------------------------------------------
 * ARQUITECTURA (infraestructura Supabase — MVP0)
 *
 * Este servicio expone lectura/actualización del perfil del usuario autenticado
 * contra la tabla `public.profiles` de Lovable Cloud. Es el PRIMER servicio de
 * CalmApp que consume datos reales de Supabase y sirve como plantilla para la
 * futura migración de `taskService`, `areaService`, etc.
 *
 * REGLAS:
 * - Todo acceso a datos remotos debe pasar por un servicio (nunca desde UI).
 * - Los mocks (mockTasks) siguen vigentes únicamente para Tablero, el último módulo pendiente de migrar a Supabase.
 * - RLS garantiza que un usuario solo puede leer/editar su propio perfil.
 */
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  nombre: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function updateCurrentProfile(
  patch: Partial<Pick<Profile, "nombre" | "avatar_url">>,
): Promise<Profile> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("No hay usuario autenticado");

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Profile;
}
