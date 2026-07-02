/**
 * ========================================================
 * Archivo: seedService
 *
 * Carga inicial (idempotente) de la estructura organizacional
 * de CalmApp para el usuario autenticado.
 *
 * Fuente de verdad: `src/data/mockTasks.ts` — es la estructura
 * definida en la documentación del proyecto (Área → Proyecto →
 * Subproyecto → Tarea).
 *
 * Reglas:
 * - Si el usuario ya tiene áreas → no hace nada.
 * - Todos los registros se crean asociados al usuario actual
 *   (RLS + defaults por servicio).
 * - Tareas sin fecha/hora/duración se guardan igual: esos campos
 *   quedan NULL y podrán editarse desde la UI.
 * - No inventa datos: usa exactamente lo que existe en el mock.
 *
 * Crear tarea, FOCO y Calendar ya operan sobre Supabase; solo
 * Tablero permanece pendiente. Este seed sigue funcionando como
 * bootstrap de entornos nuevos.

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
