/**
 * projectIdentity
 * ---------------------------------------------------------------------------
 * Paleta oficial de identidad visual de Proyectos de CalmApp.
 *
 * Reglas de la iteración actual:
 *  - Sólo Proyectos tienen identidad visual (no Áreas ni Subproyectos).
 *  - Sólo color, sin selector RGB ni personalizados: 12 valores fijos.
 *  - Todos los tonos tienen saturación moderada, coherentes entre sí.
 *  - Un Proyecto sin color usa el `DEFAULT_PROJECT_COLOR`.
 *
 * Preparado para el futuro:
 *  - El `ProjectIdentity` es un descriptor centralizado. Si mañana un
 *    proyecto añade icono/emoji/imagen, se extiende este descriptor
 *    (agregando `icon`, `emoji`, `image`, etc.) sin cambiar los
 *    consumidores que sólo leen `color`.
 *  - Los slugs (`calipso`, `azul`…) son estables y los que se guardan
 *    en Supabase (`projects.color`), no las clases Tailwind. Así se
 *    puede repintar toda la app sin migración de datos.
 */

export type ProjectColorSlug =
  | "calipso"
  | "azul"
  | "verde"
  | "morado"
  | "naranjo"
  | "amarillo"
  | "rosa"
  | "gris"
  | "indigo"
  | "turquesa"
  | "coral"
  | "oliva";

export interface ProjectColorSwatch {
  slug: ProjectColorSlug;
  label: string;
  /** Clase para un punto/círculo sólido pequeño. */
  dot: string;
  /** Clase de texto acompañante (uso puntual). */
  text: string;
  /** Clase para una barra lateral (`border-l-*`). */
  border: string;
  /** Fondo muy tenue, para chips discretos. */
  soft: string;
  /** Anillo de selección accesible. */
  ring: string;
}

/**
 * Paleta CalmApp. El orden es el que se muestra al usuario en el picker.
 * Las clases se escriben LITERALES para que Tailwind las detecte en el
 * build; no generar dinámicamente `bg-${color}-500`.
 */
export const PROJECT_COLORS: readonly ProjectColorSwatch[] = [
  { slug: "calipso",   label: "Calipso",   dot: "bg-teal-400",    text: "text-teal-700",    border: "border-l-teal-400",    soft: "bg-teal-50",    ring: "ring-teal-300" },
  { slug: "azul",      label: "Azul",      dot: "bg-blue-500",    text: "text-blue-700",    border: "border-l-blue-500",    soft: "bg-blue-50",    ring: "ring-blue-300" },
  { slug: "verde",     label: "Verde",     dot: "bg-emerald-500", text: "text-emerald-700", border: "border-l-emerald-500", soft: "bg-emerald-50", ring: "ring-emerald-300" },
  { slug: "morado",    label: "Morado",    dot: "bg-violet-500",  text: "text-violet-700",  border: "border-l-violet-500",  soft: "bg-violet-50",  ring: "ring-violet-300" },
  { slug: "naranjo",   label: "Naranjo",   dot: "bg-orange-500",  text: "text-orange-700",  border: "border-l-orange-500",  soft: "bg-orange-50",  ring: "ring-orange-300" },
  { slug: "amarillo",  label: "Amarillo",  dot: "bg-amber-400",   text: "text-amber-700",   border: "border-l-amber-400",   soft: "bg-amber-50",   ring: "ring-amber-300" },
  { slug: "rosa",      label: "Rosa",      dot: "bg-pink-400",    text: "text-pink-700",    border: "border-l-pink-400",    soft: "bg-pink-50",    ring: "ring-pink-300" },
  { slug: "gris",      label: "Gris",      dot: "bg-slate-400",   text: "text-slate-700",   border: "border-l-slate-400",   soft: "bg-slate-50",   ring: "ring-slate-300" },
  { slug: "indigo",    label: "Índigo",    dot: "bg-indigo-500",  text: "text-indigo-700",  border: "border-l-indigo-500",  soft: "bg-indigo-50",  ring: "ring-indigo-300" },
  { slug: "turquesa",  label: "Turquesa",  dot: "bg-cyan-500",    text: "text-cyan-700",    border: "border-l-cyan-500",    soft: "bg-cyan-50",    ring: "ring-cyan-300" },
  { slug: "coral",     label: "Coral",     dot: "bg-rose-400",    text: "text-rose-700",    border: "border-l-rose-400",    soft: "bg-rose-50",    ring: "ring-rose-300" },
  { slug: "oliva",     label: "Oliva",     dot: "bg-lime-600",    text: "text-lime-700",    border: "border-l-lime-600",    soft: "bg-lime-50",    ring: "ring-lime-300" },
];

/** Color por defecto para proyectos sin `color` definido en Supabase. */
export const DEFAULT_PROJECT_COLOR: ProjectColorSlug = "gris";

const BY_SLUG: Record<string, ProjectColorSwatch> = Object.fromEntries(
  PROJECT_COLORS.map((c) => [c.slug, c]),
);

/**
 * Descriptor visual de un Proyecto. Recibe el slug crudo de Supabase
 * (`color`) — que puede ser `null` o un valor desconocido si algún
 * día se elimina de la paleta — y devuelve siempre un descriptor
 * válido usando el color por defecto como fallback.
 */
export function getProjectColor(slug: string | null | undefined): ProjectColorSwatch {
  if (slug && BY_SLUG[slug]) return BY_SLUG[slug];
  return BY_SLUG[DEFAULT_PROJECT_COLOR];
}
