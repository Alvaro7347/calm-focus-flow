import { Link, useRouterState } from "@tanstack/react-router";
import { Target, Calendar, LayoutGrid, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";

const items: { to: string; label: string; icon: typeof Target; matchRoot?: boolean }[] = [
  { to: "/foco", label: "FOCO", icon: Target, matchRoot: true },
  { to: "/calendario", label: "Calendario", icon: Calendar },
  { to: "/tablero", label: "Tablero", icon: LayoutGrid },
  { to: "/crear-tarea", label: "Crear tarea", icon: ClipboardList },
];

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 border-t border-slate-200 bg-white flex items-stretch">
      {items.map((it) => {
        const active = pathname === it.to || (it.matchRoot && pathname === "/");
        const Icon = it.icon;
        return (
          <Tab key={it.to} to={it.to} active={active} icon={<Icon className="h-5 w-5" />} label={it.label} />
        );
      })}
    </nav>
  );
}

function Tab({ to, active, icon, label }: { to: string; active: boolean; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
        active ? "text-indigo-600" : "text-slate-500"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
