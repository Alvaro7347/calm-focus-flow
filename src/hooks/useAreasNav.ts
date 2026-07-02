/**
 * ========================================================
 * Hook: useAreasNav
 *
 * Responsabilidad:
 * Fuente única de datos para el shell de navegación
 * (Sidebar desktop y AreasDrawer mobile). Envuelve
 * `areaService.fetchAreasWithCounts()` en TanStack Query
 * con una queryKey compartida, garantizando que Sidebar y
 * AreasDrawer consuman exactamente la misma lista de Áreas
 * almacenada en Supabase y sin duplicar consultas.
 * ========================================================
 */
import { useQuery } from "@tanstack/react-query";
import { fetchAreasWithCounts } from "@/services/areaService";
import type { Area } from "@/types/tarea";

export const AREAS_NAV_QUERY_KEY = ["areas", "nav"] as const;

export function useAreasNav() {
  return useQuery<Area[]>({
    queryKey: AREAS_NAV_QUERY_KEY,
    queryFn: fetchAreasWithCounts,
    staleTime: 60_000,
  });
}
