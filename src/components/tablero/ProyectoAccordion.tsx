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
import { getProjectColor } from "@/lib/projectIdentity";
import { SubproyectoAccordion } from "./SubproyectoAccordion";

interface Props {
  areaSlug: string;
  proyecto: ProyectoNode;
  open: boolean;
  openSubproyectoSlug?: string;
}

export function ProyectoAccordion({ areaSlug, proyecto, open, openSubproyectoSlug }: Props) {
  const color = getProjectColor(proyecto.color);
  return (
    <section>
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
        {/* Identidad visual del proyecto: punto discreto de color. */}
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full shrink-0 ${color.dot}`}
          title={`Color del proyecto: ${color.label}`}
        />
        <h3 className="text-[15px] font-semibold text-slate-800 flex-1 truncate">
          {proyecto.nombre}
        </h3>
        <span className="text-xs text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
          {proyecto.totalTareas}
        </span>
      </Link>

      {open && (
        <div className="pl-6 pr-3 pb-2 border-l border-slate-100 ml-5 mb-2">
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
