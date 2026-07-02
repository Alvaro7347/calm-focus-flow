/**
 * ========================================================
 * Archivo: Sidebar
 *
 * Responsabilidad:
 * Barra lateral izquierda del App Shell en desktop (>= 768px).
 * Muestra el logo, la lista de áreas del usuario con sus
 * contadores y los accesos de pie (Ajustes, Usuario, Términos).
 *
 * Utilizado por:
 * - El layout raíz (src/routes/__root.tsx) como parte del
 *   App Shell desktop.
 *
 * Obtiene las Áreas desde Supabase vía el hook `useAreasNav`
 * (envoltorio de `areaService.fetchAreasWithCounts()` sobre
 * TanStack Query). Sidebar, AreasDrawer y Tablero comparten la
 * misma fuente de verdad: no existen Áreas fantasma ni
 * diferencias entre la navegación y el Tablero.
 *
 * Contraparte mobile: AreasDrawer.
 * ========================================================
 */
import { Link } from "@tanstack/react-router";
import { Settings, User, FileText } from "lucide-react";
import { useAreasNav } from "@/hooks/useAreasNav";
import { useBootstrapReady } from "@/lib/bootstrapContext";
import { slugify } from "@/lib/slug";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/brand/brand";

export function Sidebar() {
  const ready = useBootstrapReady();
  const { data: areas = [], isLoading, isFetching } = useAreasNav({ enabled: ready });
  const showLoading = !ready || isLoading || (isFetching && areas.length === 0);
  return (
    <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-border bg-background">
      {/* Logo oficial completo */}
      <Link to="/foco" className="flex flex-col items-center gap-2 px-6 pt-8 pb-8" aria-label={BRAND.name}>
        <Logo height={56} />
        <div className="text-xs text-muted-foreground text-center">{BRAND.tagline}</div>
      </Link>

      {/* Áreas */}
      <div className="px-6">
        <div className="text-xs font-semibold text-slate-400 tracking-widest mb-3">ÁREAS</div>
        <ul className="space-y-1">
          {areas.map((a) => (
            <li key={a.nombre}>
              <Link
                to="/tablero"
                search={{ area: slugify(a.nombre) }}
                className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                activeProps={{ className: "bg-indigo-50 text-indigo-700" }}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${a.color}`} aria-hidden />
                <span className="flex-1 text-left">{a.nombre}</span>
                <span className="text-xs text-slate-500 bg-slate-100 rounded-md px-2 py-0.5 min-w-6 text-center">
                  {a.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-slate-200 px-6 py-4 space-y-1">
        <Link
          to="/ajustes"
          className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          activeProps={{ className: "bg-indigo-50 text-indigo-700" }}
        >
          <span className="text-slate-500"><Settings className="h-4 w-4" /></span>
          <span>Ajustes</span>
        </Link>
        <Link
          to="/mi-cuenta"
          className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          activeProps={{ className: "bg-indigo-50 text-indigo-700" }}
        >
          <span className="text-slate-500"><User className="h-4 w-4" /></span>
          <span>Mi cuenta</span>
        </Link>
        <Link
          to="/legal"
          className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          activeProps={{ className: "bg-indigo-50 text-indigo-700" }}
        >
          <span className="text-slate-500"><FileText className="h-4 w-4" /></span>
          <span>Términos y condiciones</span>
        </Link>
      </div>
    </aside>
  );
}


