import { createFileRoute } from "@tanstack/react-router";
import { LegalSubpage, LegalSection } from "@/components/legal/LegalSubpage";

export const Route = createFileRoute("/legal/terminos")({
  component: Terminos,
});

function Terminos() {
  return (
    <LegalSubpage
      title="Términos y Condiciones"
      description="Última actualización: Julio 2026"
    >
      <LegalSection title="Uso de CalmApp">
        <p>
          CalmApp es una herramienta personal pensada para ayudarte a
          organizar tus tareas y reducir la carga mental. Al usarla, aceptas
          hacerlo de forma responsable y respetando estos términos.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilidad del usuario">
        <p>
          Eres responsable del contenido que agregas a tu cuenta (tareas,
          notas, proyectos) y de mantener tus credenciales seguras. CalmApp
          no revisa el contenido personal que introduces.
        </p>
      </LegalSection>

      <LegalSection title="Disponibilidad del servicio">
        <p>
          Trabajamos para que CalmApp esté disponible siempre que la
          necesites, pero pueden existir interrupciones por mantenimiento,
          actualizaciones o causas ajenas a nuestro control. No garantizamos
          disponibilidad ininterrumpida.
        </p>
      </LegalSection>

      <LegalSection title="Cambios futuros del producto">
        <p>
          CalmApp evoluciona. Podemos añadir, modificar o retirar
          funcionalidades para mejorar la experiencia. Si un cambio afecta
          de forma importante tu uso, intentaremos comunicarlo con claridad.
        </p>
      </LegalSection>

      <LegalSection title="Propiedad intelectual">
        <p>
          El diseño, la marca, el código y los contenidos de CalmApp son
          propiedad de sus autores. Tú conservas la propiedad de la
          información personal que introduces en tu cuenta.
        </p>
      </LegalSection>

      <LegalSection title="Limitación de responsabilidad">
        <p>
          CalmApp se ofrece "tal cual". No nos hacemos responsables de
          pérdidas indirectas derivadas del uso del producto, aunque
          ponemos todo nuestro cuidado en que sea una herramienta fiable y
          respetuosa.
        </p>
      </LegalSection>
    </LegalSubpage>
  );
}
