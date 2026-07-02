import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

export function MobileFab() {
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
