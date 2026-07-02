/**
 * LegalSubpage
 * Envoltorio común para las subpantallas del Centro Legal.
 * Mismo lenguaje visual que SettingsSubpage.
 */
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function LegalSubpage({ title, description, children }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 md:py-8 pb-32 md:pb-16 space-y-6">
      <div>
        <Link
          to="/legal"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Centro Legal
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

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </h2>
      <div className="text-sm text-slate-700 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
