/**
 * ========================================================
 * Componente: Logo
 *
 * Renderiza el logotipo oficial COMPLETO de CalmApp
 * (símbolo + wordmark). Es la ÚNICA fuente de verdad para
 * mostrar la marca completa en la interfaz.
 *
 * Para variantes:
 *  - LogoSymbol  → solo símbolo (headers compactos, favicon)
 *  - Wordmark    → solo texto (usos legados)
 * ========================================================
 */
import logoFull from "@/assets/brand/logo-full.png";
import { BRAND } from "@/brand/brand";

interface Props {
  className?: string;
  /** Altura en px. Ancho se ajusta manteniendo proporción. */
  height?: number;
}

export function Logo({ className, height = 40 }: Props) {
  return (
    <img
      src={logoFull}
      alt={BRAND.name}
      height={height}
      style={{ height, width: "auto" }}
      className={className}
      draggable={false}
    />
  );
}
