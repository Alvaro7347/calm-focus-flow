/**
 * Mapa de colores suaves por Área. Consistente con las áreas
 * del sidebar/drawer, pero en tonalidades muy claras para no
 * romper la sensación de calma en Calendar.
 */
export interface AreaSoftColor {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

const MAP: Record<string, AreaSoftColor> = {
  Soundkeleles:            { bg: "bg-violet-50",  text: "text-violet-800",  border: "border-l-violet-400",  dot: "bg-violet-500" },
  UNAB:                    { bg: "bg-blue-50",    text: "text-blue-800",    border: "border-l-blue-400",    dot: "bg-blue-500" },
  Panadería:               { bg: "bg-orange-50",  text: "text-orange-800",  border: "border-l-orange-400",  dot: "bg-orange-500" },
  Fundación:               { bg: "bg-green-50",   text: "text-green-800",   border: "border-l-green-400",   dot: "bg-green-500" },
  Familia:                 { bg: "bg-pink-50",    text: "text-pink-800",    border: "border-l-pink-400",    dot: "bg-pink-400" },
  "Finanzas personales":   { bg: "bg-teal-50",    text: "text-teal-800",    border: "border-l-teal-400",    dot: "bg-teal-500" },
  Salud:                   { bg: "bg-cyan-50",    text: "text-cyan-800",    border: "border-l-cyan-400",    dot: "bg-cyan-500" },
  "Desarrollo personal":   { bg: "bg-amber-50",   text: "text-amber-800",   border: "border-l-amber-400",   dot: "bg-amber-400" },
  UTEM:                    { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-l-violet-300",  dot: "bg-violet-300" },
};

const FALLBACK: AreaSoftColor = {
  bg: "bg-slate-50", text: "text-slate-700", border: "border-l-slate-300", dot: "bg-slate-400",
};

export function areaColor(area: string): AreaSoftColor {
  return MAP[area] ?? FALLBACK;
}
