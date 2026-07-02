/**
 * ========================================================
 * Archivo: devAuth
 *
 * Modo de desarrollo — MVP1.
 *
 * Requisito: todas las escrituras en Supabase requieren una sesión.
 * Como aún no existe la pantalla de Login, esta utilidad garantiza
 * una sesión válida usando un usuario de desarrollo.
 *
 * Comportamiento:
 * 1. Si ya existe una sesión → se reutiliza.
 * 2. Si no existe → intenta `signInWithPassword` con las credenciales
 *    del usuario de desarrollo.
 * 3. Si el usuario aún no existe → lo crea con `signUp`.
 *    (Requiere `auto_confirm_email = true` en Auth.)
 *
 * Cómo eliminar este modo cuando se implemente Login:
 *  - Borrar este archivo.
 *  - Quitar la llamada a `ensureDevSession()` en `RootComponent`.
 *  - Reemplazarla por el flujo real de autenticación.
 *
 * Las credenciales están hardcodeadas a propósito: no son secretas,
 * este usuario existe únicamente en el entorno de desarrollo.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";

export const DEV_EMAIL = "dev@calmapp.local";
export const DEV_PASSWORD = "calmapp-dev-2026";

export async function ensureDevSession(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) return;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });
  if (!signInError) return;

  // Usuario aún no existe → crearlo.
  const { error: signUpError } = await supabase.auth.signUp({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });
  if (signUpError) throw signUpError;

  // signUp devuelve sesión activa cuando auto_confirm_email está habilitado.
  const { data: after } = await supabase.auth.getSession();
  if (!after.session) {
    // Fallback: intentar signIn otra vez (por si el proyecto exige login explícito).
    const { error } = await supabase.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });
    if (error) throw error;
  }
}
