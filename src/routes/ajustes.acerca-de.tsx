import { createFileRoute } from "@tanstack/react-router";
import { SettingsSubpage } from "@/components/settings/SettingsSubpage";

const CALMAPP_VERSION = "0.1.0";
const CALMAPP_BUILD = "MVP1";

export const Route = createFileRoute("/ajustes/acerca-de")({
  component: AcercaDe,
});

function AcercaDe() {
  return (
    <SettingsSubpage title="Acerca de">
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <InfoRow label="Versión" value={CALMAPP_VERSION} />
        <InfoRow label="Build" value={CALMAPP_BUILD} />
        <InfoRow label="Producto" value="CalmApp — Tu espacio de claridad" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Sobre CalmApp
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          CalmApp es una app personal de gestión de tareas diseñada para
          <span className="font-medium"> reducir la carga mental</span>, no
          para maximizar la productividad. La interfaz busca transmitir
          calma, no urgencia.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Créditos
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Diseñado y desarrollado con cuidado por el equipo de CalmApp.
        </p>
        <p className="text-xs text-slate-500">
          Construido con React, TanStack Router, Tailwind CSS y shadcn/ui.
        </p>
      </section>
    </SettingsSubpage>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900 font-medium">{value}</span>
    </div>
  );
}
