# CalmApp

## Qué es CalmApp

CalmApp es una aplicación para reducir la carga mental organizando tareas, áreas, proyectos y subproyectos de forma tranquila y clara. Su propósito **no** es presionar al usuario con productividad, sino ayudarlo a soltar lo que tiene en la cabeza y ver con claridad lo que sigue.

El principio de diseño es simple: la interfaz debe transmitir calma, no urgencia.

## Estado actual del proyecto

En esta etapa la aplicación funciona con datos de ejemplo (mock) y ya cuenta con:

- Pantalla **FOCO** con sus 4 columnas: Hoy, Esta semana, Esperando y Sin movimiento.
- Pantalla **Calendario** con vistas Semana y Mes.
- Pantalla **Tablero**: centro de organización estructural (Área → Proyecto → Subproyecto → Tareas). Muestra una sola área a la vez; el estado (área/proyecto/subproyecto abierto) vive en la URL para permitir enlaces compartibles.
- **Navegación mobile-first**, pensada para usarse principalmente desde el celular.
- **Sidebar desktop** con la lista de áreas (cada área linkea a `/tablero?area=<slug>`).
- **Drawer de áreas** para mobile con el mismo comportamiento.
- **Tab bar inferior** en mobile con FOCO, Calendario, Tablero y Crear tarea.
- **Botón flotante (FAB)** para ir rápidamente a "Nueva tarea".
- **Rutas placeholder** para Crear tarea y Nueva tarea (aún no construidas).

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
 Datos mock o Supabase
```

Nunca:

```
Pantallas / componentes
        ↓
   Mocks directos
```

Esto permite que, cuando conectemos Supabase, IA o Google Calendar, sólo cambien los servicios y las pantallas queden intactas.

## Backend y datos

**Lovable Cloud (Supabase) es la única fuente oficial de datos de CalmApp.**

- Cliente: `@/integrations/supabase/client` (auto-generado, no editar).
- Servicios: `src/services/*Service.ts` encapsulan todo acceso a datos.
- **Google Sheets** se utilizará únicamente para la migración inicial de datos hacia Supabase; no es una fuente de datos en runtime.
- Los **mocks** en `src/data/mockTasks.ts` siguen vigentes de forma temporal hasta que `taskService` migre a Supabase.

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

## Autenticación

La infraestructura de autenticación de Lovable Cloud queda preparada, pero **aún no se construyen pantallas de Login**. Los proveedores previstos (Email, Google, otros) se activarán en una iteración posterior sin modificar la navegación actual.

## Próximos pasos

Diseñar y crear la tabla `tasks` en Supabase, y migrar `taskService` desde mocks hacia la base de datos real.


