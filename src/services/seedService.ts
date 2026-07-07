/**
 * ========================================================
 * Archivo: seedService
 *
 * LEGACY / BOOTSTRAP / DEVELOPMENT ONLY
 *
 * NO forma parte del runtime funcional de CalmApp: todas las
 * pantallas (Crear tarea, FOCO, Calendar, Tablero) y el shell
 * de navegación (Sidebar, AreasDrawer) leen exclusivamente de
 * Supabase.
 *
 * Este módulo se ejecuta una única vez por usuario nuevo, al
 * inicializar el entorno de desarrollo, para poblar Supabase
 * con la estructura organizacional de referencia definida en
 * `src/data/mockTasks.ts`. Es idempotente: si el usuario ya
 * tiene áreas, no hace nada.
 *
 * NO utilizar para nuevas funcionalidades. NO consultar los
 * mocks desde otras capas. Se retirará cuando el bootstrap
 * migre a semillas SQL versionadas.
 *
 * Reglas:
 * - Si el usuario ya tiene áreas → no hace nada.
 * - Todos los registros se crean asociados al usuario actual
 *   (RLS + defaults por servicio).
 * - Tareas sin fecha/hora/duración se guardan igual: esos campos
 *   quedan NULL y podrán editarse desde la UI.
 * - No inventa datos: usa exactamente lo que existe en el mock.
 * ========================================================
 */
import { supabase } from "@/integrations/supabase/client";
import { tareasFoco } from "@/data/mockTasks";
import { createArea } from "@/services/areaService";
import { createProject } from "@/services/projectService";
import { createSubproject } from "@/services/subprojectService";
import { createTask, type CreateTaskInput, type TaskPriority } from "@/services/taskService";
import type { Priority } from "@/types/tarea";

function mapPriority(p?: Priority): TaskPriority {
  switch (p) {
    case "alta":
      return "high";
    case "baja":
      return "low";
    case "media":
    case "normal":
    default:
      return "medium";
  }
}

function buildStartsAt(fecha?: string, hora?: string): string | null {
  if (!fecha) return null;
  const iso = hora ? `${fecha}T${hora}:00` : `${fecha}T00:00:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function seedIfEmpty(): Promise<void> {
  // Sembrar datos mock solo bajo modo desarrollo explícito.
  // Los usuarios beta reales deben partir con estado vacío.
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_SESSION !== "1") {
    return;
  }
  const { count, error: countError } = await supabase
    .from("areas")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  // Índices por nombre para no crear duplicados.
  const areaIds = new Map<string, string>();
  const projectIds = new Map<string, string>(); // key: `${areaName}::${projectName}`
  const subprojectIds = new Map<string, string>(); // key: `${areaName}::${projectName}::${subName}`

  for (const t of tareasFoco) {
    const areaName = t.area;
    const projectName = t.proyecto ?? "";
    const subName = t.subproyecto ?? "";
    if (!areaName || !projectName || !subName) continue;

    let areaId = areaIds.get(areaName);
    if (!areaId) {
      const a = await createArea({ name: areaName });
      areaId = a.id;
      areaIds.set(areaName, areaId);
    }

    const pKey = `${areaName}::${projectName}`;
    let projectId = projectIds.get(pKey);
    if (!projectId) {
      const p = await createProject({ name: projectName, area_id: areaId });
      projectId = p.id;
      projectIds.set(pKey, projectId);
    }

    const sKey = `${pKey}::${subName}`;
    let subprojectId = subprojectIds.get(sKey);
    if (!subprojectId) {
      const s = await createSubproject({ name: subName, project_id: projectId });
      subprojectId = s.id;
      subprojectIds.set(sKey, subprojectId);
    }

    const input: CreateTaskInput = {
      subproject_id: subprojectId,
      title: t.titulo,
      priority: mapPriority(t.priority),
      status: "pending",
      source: "import",
      starts_at: buildStartsAt(t.fechaProgramada, t.horaInicio),
      estimated_duration_min: t.duracionMin ?? null,
    };
    await createTask(input);
  }
}
