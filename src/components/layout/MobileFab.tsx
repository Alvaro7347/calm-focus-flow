import { Link, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";

export function MobileFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // En Finanzas el "+" es para registrar gastos (lo pone esa pantalla).
  if (pathname === "/finanzas") return null;
  return (
    <Link
      to="/crear-tarea"
      aria-label="Nueva tarea"
      className="md:hidden fixed right-4 bottom-20 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 active:scale-95 transition"
    >
      <Plus className="h-6 w-6" />
    </Link>
  );
}
