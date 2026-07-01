/**
 * ========================================================
 * Archivo: tableroService
 *
 * Responsabilidad:
 * Construye la jerarquía Área → Proyecto → Subproyecto → Tareas
 * a partir de las tareas expuestas por taskService. Es la única
 * fuente de datos de la pantalla Tablero.
 *
 * Dependencias:
 * - taskService: única fuente de tareas. No accedemos a mocks.
 *
 * Notas:
 * - Cuando una tarea no declara proyecto o subproyecto, se agrupa
 *   bajo pseudo-nodos ("Sin proyecto" / "General") para respetar
 *   la regla "no hay tareas huérfanas" sin modificar los datos
 *   existentes. Cuando Crear tarea entre en el MVP1, cada tarea
 *   nueva incluirá proyecto y subproyecto reales y estos
 *   pseudo-nodos desaparecerán naturalmente.
 * - La interfaz pública (getAreaTree, listAreasWithProjects) se
 *   mantendrá estable cuando el origen pase a Supabase.
 * ========================================================
 */
import { getAllTasks } from "@/services/taskService";
import { slugify } from "@/lib/slug";
import type { Tarea } from "@/types/tarea";

export interface SubproyectoNode {
  nombre: string;
  slug: string;
  tareas: Tarea[];
}

export interface ProyectoNode {
  nombre: string;
  slug: string;
  subproyectos: SubproyectoNode[];
  totalTareas: number;
}

export interface AreaNode {
  nombre: string;
  slug: string;
  proyectos: ProyectoNode[];
  totalTareas: number;
}

const SIN_PROYECTO = "Sin proyecto";
const SIN_SUBPROYECTO = "General";

function buildTree(): AreaNode[] {
  const tasks = getAllTasks();
  const areas = new Map<string, AreaNode>();

  for (const t of tasks) {
    const areaName = t.area;
    const proyectoName = t.proyecto?.trim() || SIN_PROYECTO;
    const subName = t.subproyecto?.trim() || SIN_SUBPROYECTO;

    let area = areas.get(areaName);
    if (!area) {
      area = { nombre: areaName, slug: slugify(areaName), proyectos: [], totalTareas: 0 };
      areas.set(areaName, area);
    }

    let proyecto = area.proyectos.find((p) => p.nombre === proyectoName);
    if (!proyecto) {
      proyecto = { nombre: proyectoName, slug: slugify(proyectoName), subproyectos: [], totalTareas: 0 };
      area.proyectos.push(proyecto);
    }

    let sub = proyecto.subproyectos.find((s) => s.nombre === subName);
    if (!sub) {
      sub = { nombre: subName, slug: slugify(subName), tareas: [] };
      proyecto.subproyectos.push(sub);
    }

    sub.tareas.push(t);
    proyecto.totalTareas += 1;
    area.totalTareas += 1;
  }

  return Array.from(areas.values());
}

/** Devuelve el árbol completo (utilizado por linkeos externos que necesiten
 *  resolver un slug de área a su nombre). */
export function getAreaTree(): AreaNode[] {
  return buildTree();
}

/** Devuelve un área específica por slug, o `undefined` si no existe. */
export function getAreaBySlug(areaSlug: string): AreaNode | undefined {
  return buildTree().find((a) => a.slug === areaSlug);
}

/** Lista de slugs+nombres de todas las áreas conocidas. Útil para el picker
 *  cuando el usuario entra a /tablero sin parámetro. */
export function listAreas(): Array<{ nombre: string; slug: string; totalTareas: number }> {
  return buildTree().map((a) => ({ nombre: a.nombre, slug: a.slug, totalTareas: a.totalTareas }));
}
