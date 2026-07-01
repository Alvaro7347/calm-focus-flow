/**
 * ========================================================
 * Archivo: slug
 *
 * Responsabilidad:
 * Convierte nombres legibles ("Soundkeleles", "Activación Paris")
 * en slugs URL-safe ("soundkeleles", "activacion-paris") para
 * usarlos como parámetros de búsqueda en TanStack Router.
 *
 * Utilizado por:
 * - Sidebar / AreasDrawer (para linkear a /tablero?area=...)
 * - tableroService (para comparar contra search params)
 * - Pantalla Tablero
 * ========================================================
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
