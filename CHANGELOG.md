# CHANGELOG

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
