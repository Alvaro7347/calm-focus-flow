/**
 * SettingsRow
 * ---------------------------------------------------------------------------
 * Fila tipo iOS reutilizable dentro de Ajustes.
 * Estructura: [Icono] [Título + descripción breve] [Chevron >]
 * Toda la fila es clickeable y navega a la subruta indicada por `to`.
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface Props {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor?: string;
  iconBg?: string;
}

export function SettingsRow({
  to,
  icon: Icon,
  title,
  description,
  iconColor = "text-indigo-600",
  iconBg = "bg-indigo-50",
}: Props) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors"
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        aria-hidden
      >
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900 truncate">
          {title}
        </span>
        <span className="block text-xs text-slate-500 truncate">
          {description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden />
    </Link>
  );
}
