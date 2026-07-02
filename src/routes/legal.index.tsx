/**
 * Ruta: /legal (índice)
 * Índice tipo iOS del Centro Legal.
 */
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Shield, Info } from "lucide-react";
import { SettingsRow } from "@/components/settings/SettingsRow";

export const Route = createFileRoute("/legal/")({
  component: LegalIndex,
});

const CALMAPP_VERSION = "0.1.0";
const CALMAPP_BUILD = "MVP1";
const LAST_UPDATE = "Julio 2026";

function LegalIndex() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 pb-32 md:pb-16 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          Centro Legal
        </h1>
        <p className="text-sm text-slate-500">
          Toda la información legal de CalmApp, clara y en un solo lugar.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
        <SettingsRow
          to="/legal/terminos"
          icon={FileText}
          title="Términos y Condiciones"
          description="Cómo usar CalmApp con tranquilidad"
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <SettingsRow
          to="/legal/privacidad"
          icon={Shield}
          title="Política de Privacidad"
          description="Qué datos guardamos y cómo los cuidamos"
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <SettingsRow
          to="/legal/licencias"
          icon={Info}
          title="Licencias y Tecnologías"
          description="El stack detrás de CalmApp"
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
      </section>

      <footer className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 text-center space-y-1">
        <p className="text-sm font-semibold text-slate-900">CalmApp</p>
        <p className="text-xs text-slate-500">
          Versión {CALMAPP_BUILD} · v{CALMAPP_VERSION}
        </p>
        <p className="text-xs text-slate-400">
          Última actualización: {LAST_UPDATE}
        </p>
      </footer>
    </div>
  );
}
