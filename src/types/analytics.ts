/**
 * Tipos compartidos de la infraestructura de medición.
 * Ver también: analyticsEvents.ts (nombres canónicos).
 */

export type PersonaSegment =
  | "emprendedor_freelancer"
  | "profesional_sobrecargado"
  | "estudiante_universitario"
  | "otro"
  | "desconocido"
  | (string & {});

export type ResearchMethod =
  | "entrevista_presencial"
  | "whatsapp"
  | "formulario"
  | "llamada"
  | "observacion"
  | (string & {});

export type SignalStrength = "alta" | "media" | "baja" | "contradictoria" | (string & {});

export type EvidenceType =
  | "dolor"
  | "alivio"
  | "diferenciacion"
  | "confianza_ia"
  | "pago"
  | "recomendacion"
  | "abandono"
  | "calendar"
  | "otro"
  | (string & {});

export type ResearchDecision =
  | "continuar"
  | "ajustar"
  | "descartar"
  | "pivotar"
  | "investigar_mas"
  | (string & {});

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export interface ExperimentAssignment {
  id: string;
  user_id: string;
  experiment_key: string;
  variant: string;
  assigned_at: string;
}

export interface InAppSurveyResponse {
  id: string;
  user_id: string;
  survey_key: string;
  question_key: string;
  answer_value: string | null;
  answer_number: number | null;
  answer_text: string | null;
  context: Record<string, unknown>;
  route: string | null;
  created_at: string;
}

export interface UserResearchProfile {
  user_id: string;
  persona_segment: PersonaSegment | null;
  current_tool: string | null;
  main_pain: string | null;
  acquisition_source: string | null;
  willingness_to_pay: string | null;
  test_group: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalResearchNote {
  id: string;
  researcher_user_id: string | null;
  participant_label: string | null;
  participant_segment: string | null;
  research_method: ResearchMethod;
  hypothesis_area: string | null;
  question_key: string | null;
  answer_text: string | null;
  signal_strength: SignalStrength | null;
  evidence_type: EvidenceType | null;
  decision: ResearchDecision | null;
  notes: string | null;
  created_at: string;
}
