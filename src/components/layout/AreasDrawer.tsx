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
 * Obtiene las áreas desde areaService (getAreas), que las
 * deriva de las tareas de taskService. Sidebar, AreasDrawer
 * y Tablero comparten así la misma lista de Áreas: no existen
 * Áreas fantasma. En el MVP1 taskService pasará a Supabase y
 * este componente no requerirá cambios.
 * ========================================================
 */
import { Settings, User, FileText, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getAreas } from "@/services/areaService";
import { slugify } from "@/lib/slug";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AreasDrawer({ open, onClose }: Props) {
  const areas = getAreas();
  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-4/5 max-w-[320px] bg-white shadow-xl transition-transform md:hidden flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-label="Áreas"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none" aria-hidden>
              <path d="M6 28 L18 8 L30 28 Z" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
              <path d="M13 22 L18 14 L23 22" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" fill="none" />
            </svg>
            <div className="font-bold text-slate-900">CalmApp</div>
          </div>
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
          <FooterItem icon={<Settings className="h-4 w-4" />} label="Ajustes" />
          <FooterItem icon={<User className="h-4 w-4" />} label="Usuario" />
          <FooterItem icon={<FileText className="h-4 w-4" />} label="Términos y condiciones" />
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
