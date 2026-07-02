/**
 * ========================================================
 * Componente: LogoSymbol
 *
 * Renderiza únicamente el símbolo oficial de CalmApp (sin
 * texto). Se usa en headers compactos, estados vacíos, 404,
 * splash screen y como marca decorativa en baja opacidad.
 * ========================================================
 */
import symbol from "@/assets/brand/logo-symbol.png";
import { BRAND } from "@/brand/brand";

interface Props {
  className?: string;
  /** Tamaño (px). Se renderiza cuadrado. */
  size?: number;
  /** Opacidad opcional (0-1) para usos decorativos. */
  opacity?: number;
  ariaHidden?: boolean;
}

export function LogoSymbol({ className, size = 40, opacity, ariaHidden }: Props) {
  return (
    <img
      src={symbol}
      alt={ariaHidden ? "" : `${BRAND.name} — símbolo`}
      aria-hidden={ariaHidden}
      width={size}
      height={size}
      style={{ width: size, height: size, opacity }}
      className={className}
      draggable={false}
    />
  );
}
