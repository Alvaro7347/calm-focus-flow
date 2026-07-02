/**
 * ========================================================
 * Sistema de marca — CalmApp
 *
 * Única fuente de verdad para el nombre, slogan y metadatos
 * de la identidad visual. Cualquier referencia futura al
 * nombre de la aplicación debe provenir de este archivo.
 * ========================================================
 */

export const BRAND = {
  name: "CalmApp",
  slogan: "Organiza tu día. Recupera tu calma.",
  tagline: "Tu espacio de claridad",
  description:
    "CalmApp es tu espacio de claridad: una app personal para gestionar tareas y reducir la carga mental, no para exigir más productividad.",
  version: "MVP1 · 0.1.0",
  themeColor: "#6D5EF8",
  backgroundColor: "#FFFFFF",
} as const;

export type Brand = typeof BRAND;
