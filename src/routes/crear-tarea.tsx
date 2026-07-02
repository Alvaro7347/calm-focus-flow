/**
 * ========================================================
 * Ruta: /crear-tarea
 *
 * Punto de entrada del modo CREATE de Task Detail.
 *
 * Task Detail es el ÚNICO formulario de tareas de CalmApp
 * (ver `src/components/TaskDetail`). Esta ruta simplemente
 * abre el sheet en modo `create`. Al cerrarlo, vuelve a FOCO.
 *
 * En iteraciones posteriores, FOCO / Calendar / Tablero abrirán
 * `TaskDetailSheet` en modo `edit` desde sus propias vistas sin
 * cambiar de URL. La existencia de esta ruta se mantiene como
 * punto de entrada directo (FAB, deep-links, tab bar mobile).
 * ========================================================
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { TaskDetailSheet } from "@/components/TaskDetail";

export const Route = createFileRoute("/crear-tarea")({
  head: () => ({ meta: [{ title: "Crear tarea — CalmApp" }] }),
  component: CrearTareaScreen,
});

function CrearTareaScreen() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Abre el sheet automáticamente al entrar a la ruta.
  useEffect(() => {
    setOpen(true);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Al cerrar el sheet, salimos de la ruta hacia FOCO para no
    // dejar la pantalla vacía detrás.
    if (!next) {
      // Pequeño delay para que la animación de cierre pueda correr.
      setTimeout(() => navigate({ to: "/foco" }), 150);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TaskDetailSheet open={open} onOpenChange={handleOpenChange} mode="create" />
    </div>
  );
}
