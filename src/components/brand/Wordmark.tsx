/**
 * ========================================================
 * Componente: Wordmark
 *
 * Renderiza el logotipo horizontal oficial de CalmApp (solo
 * texto). Es la ÚNICA fuente de verdad para mostrar la marca
 * en la interfaz. No debe recrearse el logo con texto o SVG:
 * siempre debe consumirse este componente.
 * ========================================================
 */
import wordmark from "@/assets/calmapp-wordmark.png.asset.json";

interface Props {
  className?: string;
  /** Altura en px. Ancho se ajusta manteniendo proporción. */
  height?: number;
}

export function Wordmark({ className, height = 28 }: Props) {
  return (
    <img
      src={wordmark.url}
      alt="CalmApp"
      height={height}
      style={{ height, width: "auto" }}
      className={className}
      draggable={false}
    />
  );
}
