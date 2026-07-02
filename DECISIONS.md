# DECISIONS.md — CalmApp

Registro de decisiones de producto ya cerradas. No reabrir sin justificación explícita.
Última actualización: 1 de julio, 2026.

## Identidad y filosofía

- Nombre: **CalmApp**. Tagline: "Tu espacio de claridad".
- Propósito: reducir la carga mental de una persona con múltiples áreas de responsabilidad. NO es una herramienta de productividad.
- Principio de diseño no negociable: la interfaz transmite calma, no urgencia. Evitar colores saturados compitiendo entre sí, badges de alerta permanentes, densidad visual alta.

## Modelo de datos

- Jerarquía: Área → Proyecto → Subproyecto → Tarea.
- Regla permanente: toda tarea pertenece siempre a un Área, un Proyecto y un Subproyecto reales. No existen nodos de relleno tipo "Sin proyecto" o "General". Una tarea incompleta es un dato inválido, no un caso a resolver con un nodo automático.
- Las Áreas se leen desde Supabase. Sidebar, Drawer y Tablero muestran siempre la misma lista (a través de `useAreasNav` / `areaService.fetchAreasWithCounts()`).
- Fuente de verdad de datos: **Supabase** es la única fuente oficial. Crear tarea, FOCO, Calendar, Tablero y el shell de navegación (Sidebar, AreasDrawer) leen exclusivamente de Supabase. Los mocks (`mockTasks`) sobreviven únicamente como semilla de bootstrap en `seedService` para entornos de desarrollo y no forman parte del runtime.
- Dependencias entre tareas: fuera de alcance de MVP1.
- Tiempo estimado por tarea: campo manual desde MVP1 (valores típicos: 15/30/45/60/90/120 min).
- Distinción conceptual: `Fecha límite` = deadline duro/no negociable. `Fecha programada` = cuándo el usuario decide ejecutarla. Son campos distintos, no intercambiables.

## Prioridad

- Exactamente 3 niveles: **Alta, Media, Baja**. No existe un cuarto nivel "Normal" — fue evaluado y eliminado deliberadamente. Si una tarea no tiene prioridad asignada, el default es **Media**, nunca un cuarto valor.
- La prioridad NO se representa con badges de color sólido permanentes en las tarjetas de tarea. Vive como filtro opcional (botón "Filtros"), no como elemento visual fijo — para no competir con el color de Área, que es el único código de color persistente de la app.

## Pantalla FOCO

- Es la pantalla de aterrizaje de la app (landing).
- 4 columnas fijas, en este orden: **1. Hoy · 2. Esta semana · 3. Esperando · 4. Sin movimiento**.
- Dentro de "Hoy" y "Esta semana" el orden es cronológico. "Esperando" y "Sin movimiento" no llevan hora.
- La asignación de tareas a cada columna es 100% automática (por fecha + estado), nunca manual. No debe existir un botón para "agregar tarea a foco" manualmente.
- Horizonte de la columna "Esta semana": 7 días hacia adelante.
- Tareas vencidas no se marcan con alarma (nada de rojo/negrita/"¡Vencida!"). Se muestran con un texto secundario gris discreto, ej. "Pendiente desde ayer".
- Sin puntos ni badges de color de prioridad en las tarjetas de FOCO.

## Tablero

- Árbol jerárquico expandible: Área → Proyecto → Subproyecto → Tareas. NO es un Kanban por estado.
- Muestra una sola Área a la vez; el estado de navegación (área/proyecto/subproyecto abierto) vive en la URL.

## Calendario

- Selector de 3 vistas: Día / Semana / Mes. Vista por defecto: Semana.
- Vista Semana reutiliza el mismo patrón de tarjeta que la columna "Esta semana" de FOCO.
- Vista Mes usa puntos de color por Área en cada celda, NO texto de eventos truncado (evitar la densidad visual típica de calendarios genéricos tipo Google Calendar).

## Navegación (mobile-first)

- El uso principal de la app es desde celular, no desde escritorio. El diseño mobile no es una versión "encogida" del desktop — tiene su propio patrón de navegación.
- Mobile: tab bar inferior fija con 4 ítems — **FOCO, Calendario, Tablero, Crear tarea**. Drawer de Áreas (no sidebar fijo) accesible desde el header. FAB flotante "+" → pantalla "Nueva tarea".
- Dos caminos de entrada de tareas, ambos necesarios: **"Nueva tarea"** (FAB, captura libre por texto o voz, la IA clasifica automáticamente Área/Proyecto/Subproyecto/Fecha/Prioridad) y **"Crear tarea"** (tab bar, formulario manual con dropdowns explícitos, para cuando el usuario quiere control total sin depender de la IA).
- Desktop (≥768px): sidebar fijo + barra superior, mismo contenido que las variantes mobile.

## IA

- La clasificación automática de texto/voz en "Nueva tarea" es parte de MVP1, no una fase futura.
- Los recordatorios/notificaciones en el celular NO se construyen como sistema propio de push notifications. Se resuelven apoyándose en las notificaciones nativas de Google Calendar, una vez esté conectada la sincronización real (Sheets/CalmApp → Calendar).
- Historial de decisiones discutidas por proyecto (chat con memoria persistente por proyecto): **diferido a MVP2**. No es parte de MVP1 — es una superficie de producto distinta (más cercana a un chat con memoria) y no bloquea que la app sea funcional para uso diario.

## Arquitectura de código (ya implementada, mantener)

- Ninguna pantalla o componente importa datos mock o el cliente Supabase directamente. Todo pasa por la capa de servicios (`taskService`, `areaService`, `focusService`, `calendarService`, `tableroService`).
- Cuando el origen de datos de un módulo cambia (por ejemplo, al migrar Tablero de mock a Supabase, o al integrar Google Calendar), solo cambian los servicios — las pantallas y componentes no deberían requerir cambios.

