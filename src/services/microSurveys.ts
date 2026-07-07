/**
 * Catálogo de micro-preguntas in-app de CalmApp.
 *
 * Cada pregunta es breve, con opciones cerradas. NO se registra texto libre
 * sensible: sólo el `value` (id corto de la opción) llega al backend.
 *
 * Las preguntas se agrupan por "placement" (ubicación en la app). El hook
 * `useMicroSurveyGate(placement)` decide cuál puede mostrarse en cada momento
 * según reglas anti-saturación.
 */
import type { IconType } from "react";
import { IN_APP_SURVEY_KEYS } from "./analyticsEvents";

export type MicroSurveyPlacement =
  | "mi_cuenta"
  | "after_tu_dia_close"
  | "after_focus_review";

export type ResearchProfileField =
  | "persona_segment"
  | "current_tool"
  | "main_pain";

export interface MicroQuestionOption {
  /** Identificador corto, canónico, sin datos personales. */
  value: string;
  label: string;
}

export interface MicroQuestion {
  surveyKey: string;
  questionKey: string;
  /** Origen semántico del prompt (para analytics). Nunca contenido del usuario. */
  source: string;
  title: string;
  question: string;
  options: MicroQuestionOption[];
  /** Si está seteado, la respuesta se persiste también en user_research_profiles. */
  profileField?: ResearchProfileField;
  /** Máx. una respuesta por semana para esta pregunta (opcional). */
  maxOncePerWeek?: boolean;
}

const {
  RESEARCH_PROFILE_SEGMENT,
  RESEARCH_PROFILE_CURRENT_TOOL,
  RESEARCH_PROFILE_MAIN_PAIN,
  DAILY_BRIEF_HELPFUL,
  CLARITY_AFTER_USE,
} = IN_APP_SURVEY_KEYS;

const PERSONA_SEGMENT: MicroQuestion = {
  surveyKey: RESEARCH_PROFILE_SEGMENT,
  questionKey: "persona_segment",
  source: "mi_cuenta",
  title: "Una pregunta rápida",
  question: "¿Qué describe mejor tu situación hoy?",
  options: [
    { value: "emprendedor_freelancer", label: "Emprendedor o freelancer" },
    { value: "profesional_sobrecargado", label: "Profesional con muchas responsabilidades" },
    { value: "estudiante_universitario", label: "Estudiante universitario" },
    { value: "otro", label: "Otro" },
  ],
  profileField: "persona_segment",
};

const CURRENT_TOOL: MicroQuestion = {
  surveyKey: RESEARCH_PROFILE_CURRENT_TOOL,
  questionKey: "current_tool",
  source: "mi_cuenta",
  title: "Una pregunta rápida",
  question: "¿Dónde organizas principalmente tus pendientes hoy?",
  options: [
    { value: "whatsapp", label: "WhatsApp" },
    { value: "notas_celular", label: "Notas del celular" },
    { value: "calendario", label: "Calendario" },
    { value: "google_tasks", label: "Google Tasks / Reminders" },
    { value: "notion_trello_todoist", label: "Notion / Trello / Todoist" },
    { value: "excel_sheets", label: "Excel / Google Sheets" },
    { value: "cabeza", label: "Principalmente en mi cabeza" },
    { value: "otro", label: "Otro" },
  ],
  profileField: "current_tool",
};

const MAIN_PAIN: MicroQuestion = {
  surveyKey: RESEARCH_PROFILE_MAIN_PAIN,
  questionKey: "main_pain",
  source: "mi_cuenta",
  title: "Una pregunta rápida",
  question: "¿Qué te pesa más cuando intentas organizarte?",
  options: [
    { value: "pendientes_dispersos", label: "Tengo pendientes repartidos en muchas partes" },
    { value: "no_se_que_hacer_primero", label: "No sé qué hacer primero" },
    { value: "miedo_olvidar", label: "Me da miedo olvidar algo importante" },
    { value: "muchos_dependen_de_mi", label: "Muchas personas dependen de mí" },
    { value: "no_cierro_el_dia", label: "Me cuesta cerrar el día tranquilo" },
    { value: "otro", label: "Otro" },
  ],
  profileField: "main_pain",
};

const DAILY_BRIEF: MicroQuestion = {
  surveyKey: DAILY_BRIEF_HELPFUL,
  questionKey: "helpful_simple",
  source: "tu_dia",
  title: "Una pregunta rápida",
  question: "¿Tu Día te ayudó a decidir qué hacer ahora?",
  options: [
    { value: "yes", label: "Sí" },
    { value: "somewhat", label: "Más o menos" },
    { value: "no", label: "No" },
  ],
  maxOncePerWeek: true,
};

const CLARITY: MicroQuestion = {
  surveyKey: CLARITY_AFTER_USE,
  questionKey: "clarity_simple",
  source: "foco",
  title: "Una pregunta rápida",
  question: "Después de usar CalmApp, ¿sientes más claridad que antes?",
  options: [
    { value: "yes", label: "Sí, más claridad" },
    { value: "somewhat", label: "Un poco" },
    { value: "no", label: "No mucho" },
  ],
  maxOncePerWeek: true,
};

/** Candidatos por placement, en orden de prioridad. */
export const MICRO_SURVEY_PLACEMENTS: Record<MicroSurveyPlacement, MicroQuestion[]> = {
  mi_cuenta: [PERSONA_SEGMENT, CURRENT_TOOL, MAIN_PAIN],
  after_tu_dia_close: [DAILY_BRIEF],
  after_focus_review: [CLARITY],
};

// Evita warnings de import de tipos no usados en algunos setups.
export type _IconType = IconType;
