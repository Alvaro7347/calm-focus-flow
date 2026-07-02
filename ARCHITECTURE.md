# CalmApp — Architecture

## Jerarquía del dominio

CalmApp modela la vida del usuario con una jerarquía estricta de cuatro niveles:

```
Profile (usuario autenticado)
  └── Area
       └── Project
            └── Subproject
                 └── Task
```

Cada nivel pertenece obligatoriamente al nivel superior. No existen registros huérfanos: la integridad referencial se garantiza con Foreign Keys en Supabase.

## Tablas de Supabase (MVP1)

### `profiles`
Perfil del usuario autenticado (creado automáticamente por el trigger `on_auth_user_created`).
Campos: `id` (= `auth.users.id`), `nombre`, `email`, `avatar_url`, `created_at`, `updated_at`.

### `areas`
- Pertenece a un `user_id` (FK → `profiles.id`, `ON DELETE CASCADE`).
- `name`, `color`, `icon`, `display_order`, `archived_at`.
- **Unicidad**: `(user_id, lower(name))`. Dos usuarios pueden tener áreas con el mismo nombre.
- Índices: `user_id`, `(user_id, display_order)`, `archived_at`.

### `projects`
- Pertenece a un `area_id` (FK → `areas.id`, `ON DELETE RESTRICT`).
- `name`, `description`, `display_order`, `archived_at`.
- **Unicidad**: `(area_id, lower(name))`. El mismo nombre puede existir en otra Área.
- Índices: `area_id`, `(area_id, display_order)`, `archived_at`.

### `subprojects`
- Pertenece a un `project_id` (FK → `projects.id`, `ON DELETE RESTRICT`).
- `name`, `display_order`, `archived_at`. **Sin descripción** (decisión de producto).
- **Unicidad**: `(project_id, lower(name))`.
- Índices: `project_id`, `(project_id, display_order)`, `archived_at`.

## Núcleo operativo de tareas (MVP2)

### `tasks`
- Pertenece a **`user_id`** (FK → `profiles.id`, `ON DELETE CASCADE`) **y a `subproject_id`** (FK → `subprojects.id`, `ON DELETE RESTRICT`). **No guarda `area_id` ni `project_id`**: Área y Proyecto se derivan siempre por relación `subprojects → projects → areas`.
- Campos de contenido: `title` (obligatorio, no vacío por CHECK), `description`.
- Estado: `status` (`pending` | `completed`), `blocked_reason`. `CHECK` garantiza que `completed` implica `completed_at IS NOT NULL` y que `pending` implica `completed_at IS NULL`.
- Prioridad: `priority` (`high` | `medium` | `low`, default `medium`).
- Tiempo: `starts_at`, `estimated_duration_min`, `actual_duration_min`, `completed_at`.
- Origen: `source` (`text` | `voice` | `manual` | `import` | `api`).
- Captura: `capture_session_id` (FK → `capture_sessions.id`, `ON DELETE SET NULL`).
- Auditoría: `archived_at`, `created_at`, `updated_at` (mantenido por trigger `set_updated_at`).
- **Sin eliminación física** — usar `archived_at`.
- Índices: `user_id`, `subproject_id`, `status`, `priority`, `starts_at`, `completed_at`, `archived_at`, `capture_session_id`.

### `capture_sessions`
- Pertenece a `user_id`. Campos: `source` (`text` | `voice`), `transcription`, `created_at`.
- Prepara la captura por texto o voz. La interpretación IA se agregará en una iteración posterior (no existe aún `ai_history`).

### `attachments`
- Pertenece a `task_id` (`ON DELETE CASCADE`). Campos: `storage_path`, `filename`, `mime_type`, `size_bytes`, `created_at`.
- Los archivos **no se guardan en la base**: viven en Supabase Storage; esta tabla solo almacena metadatos y la ruta.

### `task_reminders`
- Pertenece a `task_id` (`ON DELETE CASCADE`). Campos: `remind_at`, `sent_at`, `created_at`.
- Una tarea puede tener múltiples recordatorios.

### `activity_log`
- Pertenece a `task_id` (`ON DELETE CASCADE`). Campos: `action` (texto libre), `old_value` (JSONB), `new_value` (JSONB), `created_at`.
- Bitácora append-only por RLS: el usuario puede leer e insertar, pero no editar ni borrar. Registrará creación, edición, cambio de subproyecto, cambio de fecha, cambio de prioridad, completada, archivada. La lógica de escritura se implementará en próximas iteraciones.


## Row Level Security

Todas las tablas del dominio tienen RLS activo. Un usuario solo puede ver/crear/editar/archivar sus propios registros:

- `areas`: `auth.uid() = user_id`.
- `areas`: `auth.uid() = user_id`.
- `projects`: se resuelve por join a `areas` (el proyecto pertenece al dueño del área).
- `subprojects`: se resuelve por join a `projects → areas`.
- `tasks`, `capture_sessions`: `auth.uid() = user_id`.
- `attachments`, `task_reminders`, `activity_log`: se resuelven por join a `tasks` (el registro pertenece al dueño de la tarea). `activity_log` es append-only: solo permite `SELECT` e `INSERT`.


## Archivado

**No hay eliminación física**. Se utiliza únicamente `archived_at TIMESTAMPTZ NULL`.

Cuando el usuario archive un Área, la aplicación (en una iteración posterior) propagará el archivado en cascada a sus Proyectos y Subproyectos. **La cascada NO se ejecuta en la base de datos** — es responsabilidad de la capa de aplicación, para poder mantener trazabilidad de qué fue archivado directamente vs. arrastrado. Las FK usan `ON DELETE RESTRICT` para reforzar esa decisión (nunca eliminar en cascada).

## Orden manual

`display_order INTEGER` en las tres tablas prepara la funcionalidad de drag & drop de una iteración futura. En MVP1 el valor se ordena ascendente y se desempata por `created_at`.

## Capa de servicios

Las pantallas y componentes **no acceden a Supabase directamente**. Consumen servicios en `src/services/`:

| Servicio               | Fuente actual                 | Consumidores                          |
| ---------------------- | ----------------------------- | ------------------------------------- |
| `profileService`       | Supabase (`profiles`)         | Futuros: pantalla de cuenta.          |
| `areaService`          | Mocks (sync) + Supabase (async) | Sidebar, AreasDrawer, Tablero (sync). |
| `projectService`       | Supabase                      | Preparado para MVP1.                  |
| `subprojectService`    | Supabase                      | Preparado para MVP1.                  |
| `taskService`          | Mocks                         | FOCO, Calendar, Tablero.              |
| `focusService`         | `taskService`                 | FOCO.                                 |
| `calendarService`      | `taskService`                 | Calendar.                             |
| `tableroService`       | `taskService`                 | Tablero.                              |

### Compatibilidad MVP0 → MVP1

`areaService` expone dos APIs:

- **`getAreas()` (síncrono)** — deriva Áreas desde las tareas de `taskService` (mocks). Mantiene el render del Sidebar/Drawer sin cambios. Se retirará cuando `taskService` migre a Supabase.
- **`fetchAreas()`, `createArea()`, `updateArea()`, `archiveArea()` (async)** — API definitiva contra Supabase.

`projectService` y `subprojectService` exponen solo API asíncrona: no hay derivación desde mocks porque en MVP0 las pantallas no consumen esos servicios todavía.

## Tipos TypeScript

Los tipos de las tablas se derivan directamente de `src/integrations/supabase/types.ts` (auto-generado):

```ts
export type AreaRow    = Database["public"]["Tables"]["areas"]["Row"];
export type AreaInsert = Database["public"]["Tables"]["areas"]["Insert"];
export type AreaUpdate = Database["public"]["Tables"]["areas"]["Update"];
// idem projects, subprojects
```

Nunca usar `any`. Cualquier cambio de esquema regenera los tipos y propaga los errores de compilación a los servicios.

## Flujo de datos correcto

```
Pantallas / componentes
        ↓
     Servicios (src/services/*)
        ↓
  Mocks (transitorio)  |  Supabase (definitivo)
```

Nunca importar mocks ni el cliente Supabase directamente desde una pantalla o componente.

## Google Sheets

Se usará **una única vez** para la migración inicial de datos hacia Supabase. No es una fuente de datos en runtime.
