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
 * Obtiene las áreas desde areaService (getAreas). No debe
 * importar mocks directamente. En el MVP1 areaService pasará
 * a leer desde Supabase; este componente no requerirá cambios.
 *
 * Contraparte mobile: AreasDrawer.
 * ========================================================
 */
import { Link } from "@tanstack/react-router";
import { Settings, User, FileText } from "lucide-react";
import { getAreas } from "@/services/areaService";
import { slugify } from "@/lib/slug";

export function Sidebar() {
  const areas = getAreas();
  return (
    <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <Link to="/foco" className="flex items-center gap-3 px-6 pt-6 pb-8">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
          <path d="M6 28 L18 8 L30 28 Z" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
          <path d="M13 22 L18 14 L23 22" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" fill="none" />
        </svg>
        <div className="leading-tight">
          <div className="font-bold text-slate-900 text-lg">CalmApp</div>
          <div className="text-xs text-slate-500">Tu espacio de claridad</div>
        </div>
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
        <FooterItem icon={<Settings className="h-4 w-4" />} label="Ajustes" />
        <FooterItem icon={<User className="h-4 w-4" />} label="Usuario" />
        <FooterItem icon={<FileText className="h-4 w-4" />} label="Términos y condiciones" />
      </div>
    </aside>
  );
}

function FooterItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
      <span className="text-slate-500">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
