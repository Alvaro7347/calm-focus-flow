/**
 * externalResearchService — notas de investigación externa (entrevistas,
 * WhatsApp, formularios, llamadas, observación).
 *
 * IMPORTANTE: por ahora esta capa NO tiene UI pública. Las políticas RLS
 * de public.external_research_notes exigen que auth.uid() = researcher_user_id
 * tanto para leer como para escribir. Es decir, un usuario cualquiera solo
 * podría ver notas que él mismo creó. Para uso interno del equipo, exponer
 * en una pantalla protegida por rol admin en el futuro.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  EvidenceType,
  ExternalResearchNote,
  ResearchDecision,
  ResearchMethod,
  SignalStrength,
} from "@/types/analytics";

const IS_DEV = import.meta.env.DEV;

export interface CreateExternalResearchNoteInput {
  participant_label?: string | null;
  participant_segment?: string | null;
  research_method: ResearchMethod;
  hypothesis_area?: string | null;
  question_key?: string | null;
  answer_text?: string | null;
  signal_strength?: SignalStrength | null;
  evidence_type?: EvidenceType | null;
  decision?: ResearchDecision | null;
  notes?: string | null;
}

export async function createExternalResearchNote(
  input: CreateExternalResearchNoteInput,
): Promise<{ ok: true; note: ExternalResearchNote } | { ok: false; error: string }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return { ok: false, error: "no_auth" };
    if (!input.research_method) return { ok: false, error: "research_method requerido" };

    const { data, error } = await supabase
      .from("external_research_notes")
      .insert({
        researcher_user_id: userId,
        participant_label: input.participant_label ?? null,
        participant_segment: input.participant_segment ?? null,
        research_method: input.research_method,
        hypothesis_area: input.hypothesis_area ?? null,
        question_key: input.question_key ?? null,
        answer_text: input.answer_text ?? null,
        signal_strength: input.signal_strength ?? null,
        evidence_type: input.evidence_type ?? null,
        decision: input.decision ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      if (IS_DEV) console.warn("[externalResearch] insert falló:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, note: data as ExternalResearchNote };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function listMyExternalResearchNotes(): Promise<ExternalResearchNote[]> {
  const { data, error } = await supabase
    .from("external_research_notes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    if (IS_DEV) console.warn("[externalResearch] list falló:", error.message);
    return [];
  }
  return (data ?? []) as ExternalResearchNote[];
}
