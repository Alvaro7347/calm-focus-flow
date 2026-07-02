import { Menu } from "lucide-react";
import { LogoSymbol } from "@/components/brand/LogoSymbol";
import { BRAND } from "@/brand/brand";

interface Props {
  onOpenDrawer: () => void;
}

/**
 * Header compacto mobile. Muestra únicamente el símbolo del
 * logo, sin texto — regla del sistema de marca.
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
      <LogoSymbol size={28} ariaHidden />
      <span className="sr-only">{BRAND.name}</span>
    </header>
  );
}
