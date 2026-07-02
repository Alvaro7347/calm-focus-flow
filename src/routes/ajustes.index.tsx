/**
 * Ruta: /ajustes  (índice)
 * Índice tipo iOS con las categorías de configuración de CalmApp.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  Palette,
  CalendarDays,
  Sparkles,
  Bell,
  Brain,
  Info,
} from "lucide-react";
import { SettingsRow } from "@/components/settings/SettingsRow";

export const Route = createFileRoute("/ajustes/")({
  component: AjustesIndex,
});

function AjustesIndex() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 pb-32 md:pb-16 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          Ajustes
        </h1>
        <p className="text-sm text-slate-500">
          Configuración de la aplicación.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
        <SettingsRow
          to="/ajustes/apariencia"
          icon={Palette}
          title="Apariencia"
          description="Tema claro, oscuro o del sistema"
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <SettingsRow
          to="/ajustes/calendario"
          icon={CalendarDays}
          title="Calendario"
          description="Integraciones y sincronización"
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <SettingsRow
          to="/ajustes/ia"
          icon={Sparkles}
          title="Inteligencia Artificial"
          description="Captura por voz, modelo y automatizaciones"
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <SettingsRow
          to="/ajustes/notificaciones"
          icon={Bell}
          title="Notificaciones"
          description="Recordatorios, push y email"
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <SettingsRow
          to="/ajustes/productividad"
          icon={Brain}
          title="Productividad"
          description="Preferencias de trabajo en CalmApp"
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <SettingsRow
          to="/ajustes/acerca-de"
          icon={Info}
          title="Acerca de"
          description="Versión, build y créditos"
          iconColor="text-slate-600"
          iconBg="bg-slate-100"
        />
      </section>
    </div>
  );
}
