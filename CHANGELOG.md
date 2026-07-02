# CHANGELOG

## Corrección arquitectónica — preparación de "Crear tarea" (iteración actual)

- `taskService.createTask()` ahora resuelve internamente `user_id` desde `supabase.auth.getUser()`. Las pantallas ya no envían `user_id`; si no hay usuario autenticado, el servicio lanza un error.
- Nuevo tipo `CreateTaskInput` en `taskService`: payload que una pantalla puede completar. Excluye `user_id`, `created_at`, `updated_at`, `archived_at` y `completed_at`. `TaskInsert` queda reservado para la capa de servicios.
- Verificado el encapsulamiento: ningún componente ni pantalla importa `@/integrations/supabase/client`. Todo acceso a Supabase pasa por `src/services/*`.
- Confirmado que el esquema completo del dominio (enums, tablas, FKs, índices, constraints, triggers y RLS) está versionado en `supabase/migrations/`. No se agregaron migraciones nuevas.
- Prioridades: el modelo oficial en Supabase es `high` | `medium` | `low`. El modelo antiguo (`alta` | `media` | `baja` | `normal`) permanece **solo** en los mocks del MVP y se retirará al migrar la UI.
- No se modificaron FOCO, Calendar, Tablero, navegación ni estilos.



## MVP2 — Núcleo operativo de tareas en Supabase (iteración actual)

- Se crea en Supabase el dominio central de tareas con RLS por usuario:
  - `tasks` — pertenece obligatoriamente a `user_id` + `subproject_id`. No guarda `area_id` ni `project_id`: Área y Proyecto se derivan por relación. Sin eliminación física — se usa `archived_at`. CHECK que sincroniza `status` con `completed_at`.
  - `capture_sessions` — sesiones de captura (`text` | `voice`) con `transcription`.
  - `attachments` — metadatos de archivos en Supabase Storage (`storage_path`, `filename`, `mime_type`, `size_bytes`).
  - `task_reminders` — múltiples recordatorios por tarea (`remind_at`, `sent_at`).
  - `activity_log` — bitácora append-only por tarea (`action`, `old_value`, `new_value`).
- Enums nuevos: `task_status` (pending/completed), `task_priority` (high/medium/low), `task_source` (text/voice/manual/import/api), `capture_source` (text/voice).
- Índices sobre `user_id`, `subproject_id`, `status`, `priority`, `starts_at`, `completed_at`, `archived_at`, `capture_session_id` y `task_id`.
- `taskService` gana una API asíncrona contra Supabase (`fetchTasks`, `fetchTaskById`, `createTask`, `updateTask`, `completeTask`, `reopenTask`, `archiveTask`) manteniendo la API síncrona existente sobre mocks para no tocar FOCO, Calendar ni Tablero.
- No se modificaron pantallas, navegación ni diseño visual. La app funciona idéntica.


## Consolidación arquitectónica (iteración actual)

- `src/data/mockFocus.ts` se renombra a `src/data/mockTasks.ts`: ya no alimenta sólo FOCO, sino a FOCO, Calendar y Tablero vía `taskService`.
- Fuente única de Áreas: `areaService` deriva las Áreas de las tareas expuestas por `taskService`. Se elimina `src/data/areas.ts`. Sidebar, AreasDrawer y Tablero muestran ahora exactamente la misma lista — no hay más Áreas fantasma.
- Metadatos globales del proyecto migrados a CalmApp (title, description, author, Open Graph, Twitter). `<html lang="es">`. No quedan referencias visibles a "Lovable App" / "Lovable Generated Project".
- No se modificaron FOCO, Calendar, Tablero, navegación, componentes visuales ni estilos.


## Tablero — corrección estructural (iteración actual)

- Se formaliza la regla arquitectónica permanente: **toda tarea pertenece siempre a Área + Proyecto + Subproyecto**. No hay tareas huérfanas.
- Se eliminan por completo los pseudo-nodos "Sin proyecto" y "General". `tableroService` no crea nodos automáticos: si una tarea llega incompleta, es dato inválido y se ignora del árbol (con warning en consola).
- Se completan los datos mock existentes con `proyecto` y `subproyecto` reales — no se agregaron tareas nuevas.
- La visualización de Tablero se aproxima a un árbol jerárquico: un solo contenedor con divisores sutiles y guía vertical de subproyectos, en lugar de tarjetas independientes por proyecto.

## Tablero (iteración inicial)


## Tablero (iteración actual)

- Se incorpora **Tablero** como tercer módulo principal del MVP1 (junto a FOCO y Calendar).
- Jerarquía obligatoria: Área → Proyecto → Subproyecto → Tareas. Una tarea pertenece siempre a un único Subproyecto.
- La pantalla muestra una sola Área por vez; el nombre del Área es el título.
- Proyectos y Subproyectos se muestran como acordeones: sólo uno abierto por nivel.
- Todo el estado de navegación (área, proyecto abierto, subproyecto abierto) vive en la URL vía search params de TanStack Router (`?area=...&proyecto=...&subproyecto=...`). Los enlaces son compartibles y el refresh restaura el estado.
- Sidebar (desktop) y Drawer (mobile) ahora linkean cada área a `/tablero?area=<slug>`.
- Las tareas completadas permanecen visibles con texto tachado en gris.
- Nuevo servicio `tableroService` construido sobre `taskService` — Tablero no conoce el origen de los datos y no importa mocks.
- Nueva utilidad `src/lib/slug.ts` para generar slugs URL-safe.
- Componentes reutilizables preparados para futuras acciones (crear/renombrar/eliminar/mover): `ProyectoAccordion`, `SubproyectoAccordion`, `TareaRow`.

No se modificaron FOCO ni Calendar.

## Infraestructura Supabase (MVP0) — preparación

- Conectado el proyecto a **Lovable Cloud (Supabase)**. Cliente auto-generado en `src/integrations/supabase/client.ts`.
- Nueva tabla `public.profiles` (`id`, `nombre`, `email`, `avatar_url`, `created_at`, `updated_at`) con RLS por `auth.uid()` y trigger `on_auth_user_created` que crea el perfil al registrarse un usuario.
- Trigger `profiles_set_updated_at` para mantener `updated_at`.
- Nuevo servicio `src/services/profileService.ts` como plantilla oficial de servicios que consumen Supabase.
- Documentación (`README.md`) actualizada: Supabase es la única fuente oficial de datos; Google Sheets solo para migración inicial; mocks siguen vigentes hasta completar la migración.
- Autenticación: infraestructura lista; no se construyeron pantallas de Login ni se modificó la navegación.
- No se modificaron FOCO, Calendar, Tablero ni Crear tarea. Sin cambios visuales.

## Dominio organizacional (MVP1) — Supabase

- Nuevas tablas en Supabase: `areas`, `projects`, `subprojects`, con jerarquía estricta `profile → area → project → subproject`.
- **Integridad referencial**: FK obligatorias en cada nivel; `ON DELETE RESTRICT` en projects/subprojects para evitar eliminación en cascada accidental. Sin registros huérfanos.
- **Archivado**: columna `archived_at TIMESTAMPTZ NULL` en las tres tablas. No hay eliminación física. La propagación del archivado a hijos se hará desde la capa de aplicación en una iteración posterior.
- **Unicidad de nombres**: `(user_id, lower(name))` en areas; `(area_id, lower(name))` en projects; `(project_id, lower(name))` en subprojects.
- **Orden manual**: `display_order INTEGER` en las tres tablas.
- **RLS** activo en todas las tablas, con políticas basadas en `auth.uid()` y joins hacia `areas` para projects/subprojects.
- **Índices** sobre `user_id`, `area_id`, `project_id`, `display_order` y `archived_at`.
- Trigger `set_updated_at` reutilizado en las tres tablas.
- Nuevos servicios: `projectService.ts` y `subprojectService.ts` (API asíncrona sobre Supabase: fetch, create, update, archive/unarchive).
- `areaService.ts` ahora expone doble API: `getAreas()` síncrono (deriva de mocks, mantiene Sidebar/Drawer intactos) + `fetchAreas/createArea/updateArea/archiveArea` async contra Supabase.
- Tipos TypeScript derivados de `src/integrations/supabase/types.ts`: `AreaRow/Insert/Update`, `ProjectRow/Insert/Update`, `SubprojectRow/Insert/Update`. Sin `any`.
- Nueva documentación `ARCHITECTURE.md`.
- No se modificaron pantallas ni componentes. FOCO, Calendar, Tablero y Crear tarea siguen funcionando exactamente igual.
