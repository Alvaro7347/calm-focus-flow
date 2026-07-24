import { createFileRoute } from "@tanstack/react-router";
import { Sun, Moon, Monitor, Check, type LucideIcon } from "lucide-react";
import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";

export const Route = createFileRoute("/ajustes/apariencia")({
  component: AparienciaScreen,
});

interface Option {
  value: ThemePreference;
  label: string;
  description: string;
  icon: LucideIcon;
}

const OPTIONS: Option[] = [
  { value: "light",  label: "Claro",                          description: "Fondo blanco, ideal de día.",         icon: Sun },
  { value: "dark",   label: "Oscuro",                         description: "Menos brillo, para ambientes tenues.", icon: Moon },
  { value: "system", label: "Usar configuración del dispositivo", description: "Sigue el modo del sistema.",         icon: Monitor },
];

function AparienciaScreen() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsSubpage title="Apariencia" description="Cómo se verá CalmApp.">
      <section
        role="radiogroup"
        aria-label="Tema de la aplicación"
        className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border"
      >
        {OPTIONS.map(({ value, label, description, icon: Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-accent/60 transition-colors focus:outline-none focus-visible:bg-accent"
            >
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"
                aria-hidden
              >
                <Icon className="h-5 w-5 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
              {selected ? (
                <Check className="h-5 w-5 text-primary shrink-0" aria-hidden />
              ) : (
                <span className="h-5 w-5 shrink-0" aria-hidden />
              )}
            </button>
          );
        })}
      </section>
    </SettingsSubpage>
  );
}
