import { createFileRoute } from "@tanstack/react-router";
import { LegalSubpage, LegalSection } from "@/components/legal/LegalSubpage";

export const Route = createFileRoute("/legal/privacidad")({
  component: Privacidad,
});

function Privacidad() {
  return (
    <LegalSubpage
      title="Política de Privacidad"
      description="Última actualización: Julio 2026"
    >
      <LegalSection title="Qué información almacenamos">
        <p>
          Guardamos únicamente lo necesario para que CalmApp funcione: tu
          perfil (nombre, email, preferencias) y el contenido que tú creas
          (tareas, áreas, proyectos, fechas y notas).
        </p>
      </LegalSection>

      <LegalSection title="Cómo la utilizamos">
        <p>
          Usamos tu información exclusivamente para ofrecerte el servicio:
          mostrarte tus tareas, sincronizarlas entre dispositivos y
          recordarte lo que has planificado.
        </p>
      </LegalSection>

      <LegalSection title="Qué NO compartimos">
        <p>
          No vendemos, alquilamos ni compartimos tu información con
          terceros con fines publicitarios. Tu contenido personal es tuyo.
        </p>
      </LegalSection>

      <LegalSection title="Uso de nuestra infraestructura">
        <p>
          Los datos se almacenan de forma segura en la infraestructura
          gestionada de CalmApp, con acceso protegido por autenticación y
          reglas de seguridad a nivel de fila.
        </p>
      </LegalSection>

      <LegalSection title="Futuras integraciones con IA">
        <p>
          Estamos preparando funciones de captura y organización asistida
          por inteligencia artificial. Serán opcionales, transparentes y,
          cuando las actives, te explicaremos con detalle qué información
          se procesa y cómo.
        </p>
      </LegalSection>

      <LegalSection title="Futuras integraciones con Google Calendar">
        <p>
          Planeamos permitir la sincronización con Google Calendar. Solo
          accederemos a los datos estrictamente necesarios para la
          sincronización, con tu consentimiento explícito y con la
          posibilidad de revocarlo en cualquier momento.
        </p>
      </LegalSection>

      <LegalSection title="Tus derechos">
        <p>
          Puedes acceder, corregir y eliminar tu información personal desde
          la pantalla "Mi cuenta" o solicitándolo por los canales de
          soporte. Tú decides sobre tus datos.
        </p>
      </LegalSection>
    </LegalSubpage>
  );
}
