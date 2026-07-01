/**
 * ========================================================
 * Componente: ProyectoAccordion
 *
 * Responsabilidad:
 * Acordeón de un Proyecto dentro del Área activa. Solo un
 * Proyecto abierto por Área (controlado por search.proyecto).
 * Al abrir otro, el anterior se cierra automáticamente porque
 * el estado vive en la URL.
 *
 * Dependencias:
 * - `ProyectoNode` (tableroService)
 * - `SubproyectoAccordion`
 *
 * Preparado para acciones futuras (crear subproyecto, renombrar,
 * eliminar) — la cabecera deja espacio para un slot de acciones.
 * ========================================================
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ProyectoNode } from "@/services/tableroService";
import { SubproyectoAccordion } from "./SubproyectoAccordion";

interface Props {
  areaSlug: string;
  proyecto: ProyectoNode;
  open: boolean;
  openSubproyectoSlug?: string;
}

export function ProyectoAccordion({ areaSlug, proyecto, open, openSubproyectoSlug }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <Link
        to="/tablero"
        search={(prev: Record<string, unknown>) => ({
          ...prev,
          area: areaSlug,
          proyecto: open ? undefined : proyecto.slug,
          // Al cambiar de proyecto, olvidamos el subproyecto abierto.
          subproyecto: undefined,
        })}
        resetScroll={false}
        className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <ChevronRight
          className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <h3 className="text-[15px] font-semibold text-slate-800 flex-1 truncate">
          {proyecto.nombre}
        </h3>
        <span className="text-xs text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
          {proyecto.totalTareas}
        </span>
      </Link>

      {open && (
        <div className="px-3 pb-2 pt-1">
          {proyecto.subproyectos.map((sub) => (
            <SubproyectoAccordion
              key={sub.slug}
              areaSlug={areaSlug}
              proyectoSlug={proyecto.slug}
              sub={sub}
              open={openSubproyectoSlug === sub.slug}
            />
          ))}
        </div>
      )}
    </section>
  );
}
