# CalmApp

## Qué es CalmApp

CalmApp es una aplicación para reducir la carga mental organizando tareas, áreas, proyectos y subproyectos de forma tranquila y clara. Su propósito **no** es presionar al usuario con productividad, sino ayudarlo a soltar lo que tiene en la cabeza y ver con claridad lo que sigue.

El principio de diseño es simple: la interfaz debe transmitir calma, no urgencia.

## Estado actual del proyecto

Migración a Supabase parcialmente completada:

- **Crear tarea** → Supabase.
- **FOCO** → Supabase.
- **Calendar** → Supabase.
- **Tablero** → Mock (último módulo pendiente de migración).

Pantallas disponibles:

- Pantalla **FOCO** con sus 4 columnas: Hoy, Esta semana, Esperando y Sin movimiento.
- Pantalla **Calendario** con vistas Semana y Mes.
- Pantalla **Tablero**: centro de organización estructural (Área → Proyecto → Subproyecto → Tareas). Muestra una sola área a la vez; el estado (área/proyecto/subproyecto abierto) vive en la URL para permitir enlaces compartibles.
- Pantalla **Crear tarea** operando 100% sobre Supabase.
- **Navegación mobile-first**, pensada para usarse principalmente desde el celular.
- **Sidebar desktop** con la lista de áreas (cada área linkea a `/tablero?area=<slug>`).
- **Drawer de áreas** para mobile con el mismo comportamiento.
- **Tab bar inferior** en mobile con FOCO, Calendario, Tablero y Crear tarea.
- **Botón flotante (FAB)** para ir rápidamente a "Nueva tarea".


## Tecnologías principales

- **React** para construir la interfaz.
- **TypeScript** para tipado estático.
- **Vite** como herramienta de build y desarrollo.
- **TanStack Router** para el ruteo basado en archivos.
- **Tailwind CSS** para los estilos.
- **Lucide React** para los íconos.

## Estructura general

- `src/routes`: pantallas principales de la app (una por ruta).
- `src/components`: componentes visuales reutilizables.
- `src/components/layout`: App Shell y navegación (Sidebar, TopBar, MobileHeader, AreasDrawer, MobileTabBar, MobileFab).
- `src/components/foco`: componentes específicos de la pantalla FOCO (columnas y tarjetas).
- `src/data`: datos mock temporales que se usarán hasta conectar con el backend real.
- `src/services`: capa de acceso y preparación de datos (por ejemplo `focusService`, `areaService`).
- `src/types`: tipos compartidos entre pantallas, componentes y servicios.

## Regla de arquitectura

Las pantallas y componentes **no deben importar mocks directamente**. Deben consumir datos a través de servicios.

Flujo correcto:

```
Pantallas / componentes
        ↓
     Servicios
        ↓
 Supabase (o mock temporal para Tablero)
```

Nunca:

```
Pantallas / componentes
        ↓
   Mocks o Supabase directos
```

Esto permite que, cuando conectemos servicios adicionales (IA, Google Calendar) o migre el último módulo pendiente (Tablero), sólo cambien los servicios y las pantallas queden intactas.

## Backend y datos

**Lovable Cloud (Supabase) es la única fuente oficial de datos de CalmApp.**

- Cliente: `@/integrations/supabase/client` (auto-generado, no editar).
- Servicios: `src/services/*Service.ts` encapsulan todo acceso a datos.
- **Google Sheets** se utilizará únicamente para la migración inicial de datos hacia Supabase; no es una fuente de datos en runtime.
- Los **mocks** en `src/data/mockTasks.ts` siguen vigentes de forma temporal únicamente para el módulo Tablero, hasta que se complete su migración a Supabase.


### Estructura organizacional (MVP1)

Jerarquía estricta implementada en Supabase:

```
profiles → areas → projects → subprojects
```

- Cada nivel pertenece obligatoriamente al superior (FK).
- Nombres únicos por padre (case-insensitive): áreas por usuario, proyectos por área, subproyectos por proyecto.
- No hay eliminación física: se usa `archived_at TIMESTAMPTZ`.
- `display_order` habilita ordenamiento manual (drag & drop futuro).
- RLS por usuario en todas las tablas.

Detalles completos en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

### Núcleo operativo de tareas (MVP2)

Se agrega el dominio central en Supabase, con RLS por usuario:

```
tasks ─┬─ capture_sessions (opcional, origen de la tarea)
       ├─ attachments      (archivos en Supabase Storage)
       ├─ task_reminders   (múltiples por tarea)
       └─ activity_log     (bitácora append-only)
```

- Toda tarea pertenece obligatoriamente a `user_id` + `subproject_id`. **No** existen `area_id` ni `project_id` en `tasks`: Área y Proyecto se derivan por relación.
- `status` puede ser `pending`, `waiting` o `completed`; `completed_at` se sincroniza por CHECK.
- Sin eliminación física — se usa `archived_at`.
- `taskService` expone la API asíncrona oficial contra Supabase (`fetchTasks`, `fetchFocusTasks`, `fetchScheduledTasks`, `createTask`, `updateTask`, `completeTask`, `reopenTask`, `waitTask`, `archiveTask`) y, transitoriamente, una API síncrona sobre mocks (`getAllTasks`, `getTaskById`) que consume únicamente Tablero mientras se completa su migración.

## Autenticación

La infraestructura de autenticación de Lovable Cloud queda preparada, pero **aún no se construyen pantallas de Login**. Los proveedores previstos (Email, Google, otros) se activarán en una iteración posterior sin modificar la navegación actual.

## Próximos pasos

Migrar el módulo **Tablero** a Supabase para completar la transición y retirar la API síncrona de `taskService`.




