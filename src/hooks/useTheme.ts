/**
 * useTheme
 * ---------------------------------------------------------------------------
 * Gestiona la preferencia de apariencia de CalmApp (claro / oscuro / sistema).
 *
 * - Persiste la preferencia en localStorage bajo `calmapp.theme`.
 * - Aplica/quita la clase `.dark` en <html> para activar los tokens del
 *   design system (definidos en src/styles.css).
 * - En modo "system" escucha `prefers-color-scheme` y reacciona en vivo.
 *
 * El anti-flash inicial se hace mediante un script inline en RootShell.
 */
import { useEffect, useState, useCallback } from "react";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "calmapp.theme";

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function resolveEffective(pref: ThemePreference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeClass(effective: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (effective === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = effective;
}

/**
 * Hook con estado + setter. Úsalo desde la pantalla de Ajustes.
 * El listener de `prefers-color-scheme` se registra solo si la
 * preferencia actual es "system".
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme());

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyThemeClass(resolveEffective(next));
  }, []);

  useEffect(() => {
    applyThemeClass(resolveEffective(theme));
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass(resolveEffective("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, setTheme };
}

/**
 * Inicializador global montado una vez en el árbol raíz para asegurar
 * que la clase `.dark` refleje la preferencia guardada y responda a
 * cambios del sistema aunque el usuario no visite /ajustes/apariencia.
 */
export function ThemeInitializer() {
  useTheme();
  return null;
}
