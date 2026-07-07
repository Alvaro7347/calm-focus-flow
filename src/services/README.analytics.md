# Infraestructura de medición — CalmApp

Base técnica para validar hipótesis de producto y comerciales **sin saturar al
usuario con encuestas dentro de la app**.

## Principio

1. **Observar primero** con eventos silenciosos (`analytics_events`).
2. **Preguntar solo lo que no se puede inferir**, con micro-encuestas
   (`in_app_survey_responses`).
3. **Profundizar fuera de la app** con notas de investigación externa
   (`external_research_notes`).

La métrica reina NO es DAU. Es alivio recurrente: descarga mental → claridad →
próximos pasos confirmados → retorno.

## Tablas

| Tabla                        | Uso                                                | Acceso                                       |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------- |
| `analytics_events`           | eventos silenciosos                                | insert/select propio (`auth.uid() = user_id`) |
| `user_research_profiles`     | perfil comercial / segmentación                    | insert/select/update propio                  |
| `in_app_survey_responses`    | micro-preguntas dentro de la app                   | insert/select propio                         |
| `experiment_assignments`     | variante de experimento asignada al usuario        | insert/select propio, único por experimento  |
| `external_research_notes`    | notas del equipo desde entrevistas / WhatsApp / etc | acceso propio del investigador (sin UI aún)  |

RLS activo en todas. No hay políticas `USING (true)`. Sin acceso anónimo.

## Servicios

- `src/services/analyticsService.ts` → `trackEvent(name, props?, options?)`
  - fire-and-forget, no bloquea la UI
  - descarta propiedades sensibles (`email`, `phone`, `token`, `title`, `task_title`, …)
  - captura `route` y `session_id` (sessionStorage, no persistente)
- `src/services/surveyService.ts` → `recordInAppSurveyResponse(...)`, `listMySurveyResponses()`
- `src/services/researchProfileService.ts` → `getMyResearchProfile()`, `upsertMyResearchProfile(...)`
- `src/services/externalResearchService.ts` → `createExternalResearchNote(...)`, `listMyExternalResearchNotes()`
- `src/services/analyticsEvents.ts` → catálogo de nombres canónicos + keys de encuestas
- `src/types/analytics.ts` → tipos compartidos

## Reglas de privacidad

**Nunca** registrar en `analytics_events` ni en `event_properties`:

- emails, teléfonos, nombres completos
- títulos o descripciones completas de tareas
- tokens, claves, URLs privadas
- contenido de calendario externo
- datos clínicos / sensibles

Sí registrar metadata: `has_due_date`, `priority`, `source`, `count`, `variant`,
scores 1–5, segmento, etc.

## Uso

```ts
import { trackEvent } from "@/services/analyticsService";
import { ANALYTICS_EVENTS } from "@/services/analyticsEvents";

trackEvent(ANALYTICS_EVENTS.TASK_CREATED, {
  has_due_date: true,
  has_project: true,
  priority: "media",
});
```

```ts
import { recordInAppSurveyResponse } from "@/services/surveyService";
import { IN_APP_SURVEY_KEYS } from "@/services/analyticsEvents";

await recordInAppSurveyResponse({
  surveyKey: IN_APP_SURVEY_KEYS.DAILY_BRIEF_HELPFUL,
  questionKey: "helpful_1_to_5",
  answerNumber: 4,
});
```

## Qué NO se instrumentó aún

- Ninguna pantalla actual llama `trackEvent` todavía.
- No hay UI para encuestas ni para notas externas.
- No hay dashboard de análisis.
- No hay flujo Aha Moment, pagos, ni Google Calendar.
