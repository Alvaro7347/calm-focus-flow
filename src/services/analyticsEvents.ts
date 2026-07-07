/**
 * Constantes de eventos canónicos de CalmApp.
 *
 * No es una lista cerrada: `trackEvent()` acepta cualquier string.
 * Estas constantes existen para evitar typos y para tener un catálogo
 * central de los eventos que ya sabemos que vamos a medir.
 *
 * Regla de privacidad: los nombres de evento y sus propiedades NUNCA
 * deben contener contenido personal (títulos de tareas, emails, etc.).
 */

export const ANALYTICS_EVENTS = {
  // Auth
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  USER_LOGGED_OUT: "user_logged_out",
  PROFILE_VIEWED: "profile_viewed",

  // Tareas
  TASK_CREATED: "task_created",
  TASK_UPDATED: "task_updated",
  TASK_COMPLETED: "task_completed",
  TASK_ARCHIVED: "task_archived",

  // Navegación principal
  FOCO_VIEWED: "foco_viewed",
  CALENDAR_VIEWED: "calendar_viewed",
  BOARD_VIEWED: "board_viewed",

  // Tu Día / Daily Brief
  DAILY_BRIEF_OPENED: "daily_brief_opened",
  DAILY_BRIEF_COMPLETED: "daily_brief_completed",
  DAILY_BRIEF_REOPENED: "daily_brief_reopened",
  DAILY_BRIEF_ERROR: "daily_brief_error",

  // Salud mental / claridad
  MENTAL_LOAD_SURVEY_ANSWERED: "mental_load_survey_answered",

  // Próximos pasos + IA
  NEXT_STEPS_GENERATED: "next_steps_generated",
  NEXT_STEPS_CONFIRMED: "next_steps_confirmed",
  AI_SUGGESTION_ACCEPTED: "ai_suggestion_accepted",
  AI_SUGGESTION_EDITED: "ai_suggestion_edited",
  AI_SUGGESTION_REJECTED: "ai_suggestion_rejected",

  // Monetización + growth
  PRICING_OFFER_VIEWED: "pricing_offer_viewed",
  PAYMENT_INTENT_CLICKED: "payment_intent_clicked",
  REFERRAL_INTENT_SUBMITTED: "referral_intent_submitted",

  // Integraciones (aún no instrumentadas)
  GOOGLE_CALENDAR_CONNECT_CLICKED: "google_calendar_connect_clicked",
} as const;

export type AnalyticsEventName =
  | (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
  | (string & {});

// Claves canónicas iniciales de micro-encuestas in-app.
export const IN_APP_SURVEY_KEYS = {
  MENTAL_LOAD_BEFORE: "mental_load_before",
  MENTAL_LOAD_AFTER: "mental_load_after",
  DAILY_BRIEF_HELPFUL: "daily_brief_helpful",
  AI_SUGGESTION_HELPFUL: "ai_suggestion_helpful",
  PAYMENT_INTEREST: "payment_interest",
  REFERRAL_INTENT: "referral_intent",
} as const;

export type InAppSurveyKey =
  | (typeof IN_APP_SURVEY_KEYS)[keyof typeof IN_APP_SURVEY_KEYS]
  | (string & {});
