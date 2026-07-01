import { Link, useRouterState } from "@tanstack/react-router";
import { Plus, Calendar, LayoutGrid, Target, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="flex items-center gap-2 px-6 md:px-10 py-4 border-b border-slate-100 bg-white">
      <NavBtn to="/crear" active={pathname === "/crear"} icon={<Plus className="h-4 w-4" />} label="Crear tarea" />
      <NavBtn to="/calendario" active={pathname === "/calendario"} icon={<Calendar className="h-4 w-4" />} label="Calendario" />
      <NavBtn to="/tablero" active={pathname === "/tablero"} icon={<LayoutGrid className="h-4 w-4" />} label="Tablero" />
      <NavBtn to="/foco" active={pathname === "/foco" || pathname === "/"} icon={<Target className="h-4 w-4" />} label="FOCO" />

      <div className="ml-auto flex items-center gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition-colors">
          <Plus className="h-4 w-4" />
          Nueva captura
        </button>
        <button
          aria-label="Más opciones"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function NavBtn({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
        active
          ? "bg-indigo-50 text-indigo-600 border-indigo-100"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className={active ? "text-indigo-600" : "text-indigo-500"}>{icon}</span>
      {label}
    </Link>
  );
}
