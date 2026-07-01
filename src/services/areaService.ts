/**
 * ========================================================
 * Archivo: areaService
 *
 * Responsabilidad:
 * Provee la lista de Áreas visibles en la aplicación. Es la
 * única fuente de verdad de Áreas del frontend.
 *
 * Regla arquitectónica (permanente):
 * - Las Áreas se DERIVAN de las tareas expuestas por taskService.
 *   No existen Áreas "fantasma" sin tareas asociadas.
 * - Sidebar, AreasDrawer y Tablero consumen exactamente la
 *   misma información — no hay dos listas paralelas.
 * - Este servicio NO importa mocks directamente. Cuando en el
 *   MVP1 taskService pase a Supabase, este servicio no requerirá
 *   cambios.
 *
 * Utilizado por:
 * - Sidebar (desktop)
 * - AreasDrawer (mobile)
 * - (indirectamente) Tablero, que ya arma su árbol desde
 *   taskService y por lo tanto muestra las mismas Áreas.
 * ========================================================
 */
import { getAllTasks } from "@/services/taskService";
import type { Area } from "@/types/tarea";

/**
 * Colores estables para las Áreas conocidas del proyecto. Mantener
 * este mapa alineado con la paleta oficial de CalmApp. Cualquier
 * Área nueva que aparezca en tareas pero no esté aquí toma un
 * color de la paleta fallback (determinista por nombre).
 */
const AREA_COLORS: Record<string, string> = {
  Soundkeleles: "bg-violet-500",
  UNAB: "bg-blue-500",
  Panadería: "bg-orange-500",
  Fundación: "bg-green-500",
  Familia: "bg-pink-400",
  "Finanzas personales": "bg-teal-500",
  Salud: "bg-cyan-500",
  "Desarrollo personal": "bg-amber-400",
  UTEM: "bg-violet-300",
};

const FALLBACK_PALETTE = [
  "bg-slate-400",
  "bg-emerald-500",
  "bg-rose-400",
  "bg-sky-500",
  "bg-fuchsia-400",
  "bg-lime-500",
];

function colorFor(nombre: string): string {
  if (AREA_COLORS[nombre]) return AREA_COLORS[nombre];
  // Hash determinista sobre el nombre para asignar un color estable.
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export function getAreas(): Area[] {
  const counts = new Map<string, number>();
  for (const t of getAllTasks()) {
    const nombre = t.area?.trim();
    if (!nombre) continue;
    counts.set(nombre, (counts.get(nombre) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([nombre, count]) => ({
    nombre,
    color: colorFor(nombre),
    count,
  }));
}
