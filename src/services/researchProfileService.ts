/**
 * researchProfileService — perfil de investigación/comercial del usuario.
 * NO reemplaza public.profiles (que es el perfil personal/visual).
 *
 * upsertMyResearchProfile hace merge parcial:
 *  - undefined → NO se toca el valor previo.
 *  - null      → limpia el valor (permitido explícitamente).
 *  - string    → sobrescribe.
 */
import { supabase } from "@/integrations/supabase/client";
import type { UserResearchProfile } from "@/types/analytics";

const IS_DEV = import.meta.env.DEV;

export interface ResearchProfileUpsertInput {
  persona_segment?: string | null;
  current_tool?: string | null;
  main_pain?: string | null;
  acquisition_source?: string | null;
  willingness_to_pay?: string | null;
  test_group?: string | null;
  notes?: string | null;
}

const MUTABLE_FIELDS = [
  "persona_segment",
  "current_tool",
  "main_pain",
  "acquisition_source",
  "willingness_to_pay",
  "test_group",
  "notes",
] as const;

export async function getMyResearchProfile(): Promise<UserResearchProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_research_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (IS_DEV) console.warn("[researchProfile] get falló:", error.message);
    return null;
  }
  return (data as UserResearchProfile | null) ?? null;
}

export async function upsertMyResearchProfile(
  payload: ResearchProfileUpsertInput,
): Promise<{ ok: true; profile: UserResearchProfile } | { ok: false; error: string }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return { ok: false, error: "no_auth" };

    // Solo incluir campos definidos (undefined => no tocar).
    const patch: Record<string, string | null> = {};
    for (const field of MUTABLE_FIELDS) {
      const value = payload[field];
      if (value !== undefined) patch[field] = value;
    }

    // ¿Existe fila previa?
    const { data: existing, error: fetchError } = await supabase
      .from("user_research_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      if (IS_DEV) console.warn("[researchProfile] fetch previo falló:", fetchError.message);
      return { ok: false, error: fetchError.message };
    }

    if (!existing) {
      // Insert inicial con solo los campos provistos.
      const { data, error } = await supabase
        .from("user_research_profiles")
        .insert({ user_id: userId, ...patch })
        .select("*")
        .single();
      if (error) {
        if (IS_DEV) console.warn("[researchProfile] insert falló:", error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true, profile: data as UserResearchProfile };
    }

    // Update parcial: si no hay campos para actualizar, devolver la fila actual.
    if (Object.keys(patch).length === 0) {
      return { ok: true, profile: existing as UserResearchProfile };
    }

    const { data, error } = await supabase
      .from("user_research_profiles")
      .update(patch as never)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) {
      if (IS_DEV) console.warn("[researchProfile] update falló:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, profile: data as UserResearchProfile };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
