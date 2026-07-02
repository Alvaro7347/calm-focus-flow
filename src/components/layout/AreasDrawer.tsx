/**
 * ========================================================
 * Archivo: AreasDrawer
 *
 * Responsabilidad:
 * Panel lateral deslizable con la lista de áreas del usuario
 * y accesos de pie (Ajustes, Usuario, Términos). Es la
 * contraparte mobile (< 768px) del Sidebar desktop dentro
 * del App Shell.
 *
 * Utilizado por:
 * - El layout raíz (src/routes/__root.tsx) junto al
 *   MobileHeader que lo abre/cierra.
 *
 * Obtiene las Áreas desde Supabase vía el hook `useAreasNav`
 * (envoltorio de `areaService.fetchAreasWithCounts()` sobre
 * TanStack Query, compartido con Sidebar). Sidebar, AreasDrawer
 * y Tablero comparten la misma fuente de verdad.
 * ========================================================
 */
import { Settings, User, FileText, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAreasNav } from "@/hooks/useAreasNav";
import { slugify } from "@/lib/slug";
import { Logo } from "@/components/brand/Logo";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AreasDrawer({ open, onClose }: Props) {
  const { data: areas = [] } = useAreasNav();
  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-foreground/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-4/5 max-w-[320px] bg-background shadow-xl transition-transform md:hidden flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-label="Áreas"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <Logo height={40} />
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-2 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-400 tracking-widest mb-3">ÁREAS</div>
          <ul className="space-y-1">
            {areas.map((a) => (
              <li key={a.nombre}>
                <Link
                  to="/tablero"
                  search={{ area: slugify(a.nombre) }}
                  onClick={onClose}
                  className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
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

        <div className="border-t border-slate-200 px-6 py-4 space-y-1">
          <Link
            to="/ajustes"
            onClick={onClose}
            className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <span className="text-slate-500"><Settings className="h-4 w-4" /></span>
            <span>Ajustes</span>
          </Link>
          <Link
            to="/mi-cuenta"
            onClick={onClose}
            className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <span className="text-slate-500"><User className="h-4 w-4" /></span>
            <span>Mi cuenta</span>
          </Link>
          <Link
            to="/legal"
            onClick={onClose}
            className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <span className="text-slate-500"><FileText className="h-4 w-4" /></span>
            <span>Términos y condiciones</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

function FooterItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50">
      <span className="text-slate-500">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
