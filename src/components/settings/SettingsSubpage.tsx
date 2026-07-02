/**
 * SettingsSubpage
 * ---------------------------------------------------------------------------
 * Envoltorio común para las subpantallas de Ajustes (Apariencia,
 * Calendario, IA, Notificaciones, Productividad, Acerca de).
 *
 * Incluye:
 *  - Header con botón "Volver" hacia /ajustes.
 *  - Título grande.
 *  - Contenedor de contenido con la identidad visual de CalmApp.
 */
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsSubpage({ title, description, children }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 md:py-8 pb-32 md:pb-16 space-y-6">
      <div>
        <Link
          to="/ajustes"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Ajustes
        </Link>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Placeholder elegante utilizado por las secciones aún no implementadas.
 */
export function ComingSoon({ items }: { items: string[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
      <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
        <p className="text-sm font-medium text-indigo-800">
          Disponible próximamente
        </p>
        <p className="text-xs text-indigo-700/80 mt-1">
          Estamos preparando esta sección para un próximo MVP.
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Qué incluirá
        </p>
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 text-sm text-slate-700"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
