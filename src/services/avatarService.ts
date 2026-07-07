/**
 * avatarService
 * ---------------------------------------------------------------------------
 * Sube y resuelve la foto de perfil del usuario autenticado.
 *
 * Storage: bucket privado `avatars`. Cada usuario tiene su carpeta
 * `{auth.uid()}/` y solo puede leer/escribir dentro de ella (RLS).
 *
 * En `profiles.avatar_url` guardamos el *storage path* (ej.
 * `<uid>/avatar_1720000000000.webp`), no una URL. Para mostrarlo se
 * genera una signed URL de corta duración con `resolveAvatarUrl`.
 *
 * Compatibilidad: si `avatar_url` contiene una URL http(s) antigua,
 * se devuelve tal cual.
 */
import { supabase } from "@/integrations/supabase/client";
import { updateCurrentProfile, type Profile } from "./profileService";

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

function extFromType(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export class AvatarUploadError extends Error {}

/**
 * Sube la foto del usuario autenticado, actualiza `profiles.avatar_url`
 * con el storage path y devuelve el profile actualizado.
 */
export async function uploadCurrentUserAvatar(file: File): Promise<Profile> {
  if (!file) throw new AvatarUploadError("No se seleccionó ningún archivo.");
  if (!ALLOWED.has(file.type)) {
    throw new AvatarUploadError(
      "Formato no soportado. Usa JPG, PNG o WEBP.",
    );
  }
  if (file.size > MAX_BYTES) {
    throw new AvatarUploadError(
      "La imagen es demasiado pesada. Intenta con una foto de hasta 2 MB.",
    );
  }

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userRes.user;
  if (!user) throw new AvatarUploadError("No hay usuario autenticado.");

  const ext = extFromType(file.type);
  const path = `${user.id}/avatar_${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });
  if (upErr) throw upErr;

  // Intentamos borrar archivos previos del usuario (best-effort, no bloquea).
  try {
    const { data: list } = await supabase.storage
      .from(BUCKET)
      .list(user.id, { limit: 100 });
    const stale =
      list
        ?.map((f) => `${user.id}/${f.name}`)
        .filter((p) => p !== path) ?? [];
    if (stale.length > 0) {
      await supabase.storage.from(BUCKET).remove(stale);
    }
  } catch {
    /* ignore cleanup errors */
  }

  return updateCurrentProfile({ avatar_url: path });
}

/**
 * Devuelve una URL utilizable en <img src>. Si `avatar_url` es un
 * storage path, genera una signed URL. Si es una URL http antigua,
 * la devuelve tal cual. Si no hay valor, null.
 */
export async function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
): Promise<string | null> {
  if (!avatarUrl) return null;
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(avatarUrl, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
