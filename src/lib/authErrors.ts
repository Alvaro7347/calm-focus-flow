/**
 * Traduce errores comunes de Supabase Auth a mensajes claros en español.
 * Evita mensajes crípticos hacia el usuario final.
 */
export function humanizeAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials"))
    return "El correo o la contraseña no coinciden.";
  if (msg.includes("email not confirmed"))
    return "Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.";
  if (msg.includes("user already registered") || msg.includes("already registered"))
    return "Ya existe una cuenta con este correo.";
  if (msg.includes("password should be") || msg.includes("password is too short") || msg.includes("weak password"))
    return "La contraseña es demasiado débil. Usa al menos 8 caracteres.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Demasiados intentos. Esperá un momento e intentalo de nuevo.";
  if (msg.includes("network"))
    return "Sin conexión. Verificá tu internet e intentalo nuevamente.";
  if (msg.includes("invalid email"))
    return "El correo electrónico no es válido.";
  if (msg.includes("token") && msg.includes("expired"))
    return "El enlace ha expirado. Solicita uno nuevo.";
  if (msg.includes("otp") && msg.includes("expired"))
    return "El enlace expiró. Solicitá uno nuevo.";

  return "No pudimos completar la acción. Intentalo nuevamente.";
}
