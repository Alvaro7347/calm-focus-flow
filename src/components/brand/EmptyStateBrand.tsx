/**
 * ========================================================
 * Componente: EmptyStateBrand
 *
 * Estado vacío decorativo con el símbolo del logo en baja
 * opacidad. Reutilizable en cualquier lista/columna sin
 * tareas.
 * ========================================================
 */
import { LogoSymbol } from "@/components/brand/LogoSymbol";

interface Props {
  title?: string;
  description?: string;
  className?: string;
}

export function EmptyStateBrand({
  title = "Sin tareas",
  description = "Cuando tengas algo aquí, aparecerá con calma.",
  className,
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className ?? ""}`}
    >
      <LogoSymbol size={64} opacity={0.12} ariaHidden />
      <div className="text-sm font-medium text-foreground/70">{title}</div>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
