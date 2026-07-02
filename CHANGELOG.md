# CHANGELOG

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
