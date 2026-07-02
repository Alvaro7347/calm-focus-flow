import { Menu } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { BRAND } from "@/brand/brand";

interface Props {
  onOpenDrawer: () => void;
}

/**
 * Header compacto mobile. Muestra el wordmark oficial (solo texto)
 * de CalmApp — regla del sistema de marca en la zona superior.
 */
export function MobileHeader({ onOpenDrawer }: Props) {
  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background px-4 h-14">
      <button
        onClick={onOpenDrawer}
        aria-label="Abrir menú de áreas"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground/70 hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Wordmark height={22} />
      <span className="sr-only">{BRAND.name}</span>
    </header>
  );
}
