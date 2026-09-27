/**
 * Ruta: /ajustes/semana
 * Ritual Semanal "Preparar mi semana". La lógica vive en
 * `PrepararSemanaScreen` y `weeklyRitualService`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PrepararSemanaScreen } from "@/components/semana/PrepararSemanaScreen";

export const Route = createFileRoute("/ajustes/semana")({
  head: () => ({ meta: [{ title: "Preparar mi semana — CalmApp" }] }),
  component: PrepararSemanaScreen,
});
