import { createFileRoute } from "@tanstack/react-router";
import { LegalSubpage, LegalSection } from "@/components/legal/LegalSubpage";

export const Route = createFileRoute("/legal/licencias")({
  component: Licencias,
});

const TECHNOLOGIES: { name: string; description: string }[] = [
  {
    name: "React",
    description: "Biblioteca para construir la interfaz de usuario.",
  },
  {
    name: "TypeScript",
    description: "Tipado estático para un código más seguro y mantenible.",
  },
  {
    name: "TanStack Router",
    description: "Enrutado tipado y basado en archivos.",
  },
  {
    name: "TanStack Query",
    description: "Gestión de datos remotos, caché e invalidaciones.",
  },
  {
    name: "Tailwind CSS",
    description: "Sistema de estilos utilitarios coherente con el diseño.",
  },
  {
    name: "shadcn/ui",
    description: "Componentes accesibles y personalizables.",
  },
  {
    name: "Supabase",
    description: "Base de datos, autenticación y capa de seguridad.",
  },
];

function Licencias() {
  return (
    <LegalSubpage
      title="Licencias y Tecnologías"
      description="El stack que hace posible CalmApp."
    >
      <LegalSection title="Sobre el stack">
        <p>
          CalmApp está construida con tecnologías modernas de código
          abierto, elegidas por su fiabilidad, rendimiento y respeto por la
          experiencia del usuario. Cada pieza cumple un rol claro dentro de
          la arquitectura.
        </p>
      </LegalSection>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
        {TECHNOLOGIES.map((tech) => (
          <div key={tech.name} className="px-4 py-3.5">
            <p className="text-sm font-medium text-slate-900">{tech.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{tech.description}</p>
          </div>
        ))}
      </section>

      <LegalSection title="Reconocimientos">
        <p>
          Agradecemos a las comunidades detrás de cada uno de estos
          proyectos. Sus licencias originales se mantienen intactas en el
          código fuente de sus respectivas dependencias.
        </p>
      </LegalSection>
    </LegalSubpage>
  );
}
