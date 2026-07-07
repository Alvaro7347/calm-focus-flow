/**
 * researchProfileService — perfil de investigación/comercial del usuario.
 * NO reemplaza public.profiles (que es el perfil personal/visual).
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

    const row = {
      user_id: userId,
      persona_segment: payload.persona_segment ?? null,
      current_tool: payload.current_tool ?? null,
      main_pain: payload.main_pain ?? null,
      acquisition_source: payload.acquisition_source ?? null,
      willingness_to_pay: payload.willingness_to_pay ?? null,
      test_group: payload.test_group ?? null,
      notes: payload.notes ?? null,
    };

    const { data, error } = await supabase
      .from("user_research_profiles")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      if (IS_DEV) console.warn("[researchProfile] upsert falló:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, profile: data as UserResearchProfile };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
