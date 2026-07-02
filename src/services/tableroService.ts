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
 * Regla arquitectónica oficial de CalmApp (permanente):
 * - Toda tarea DEBE pertenecer a un Área, un Proyecto y un
 *   Subproyecto reales.
 * - Este servicio NUNCA crea proyectos automáticamente.
 * - Este servicio NUNCA crea subproyectos automáticamente.
 * - Este servicio NUNCA inventa nodos (no existen "Sin proyecto"
 *   ni "General" ni ninguna categoría de relleno).
 * - Si una tarea llega sin proyecto o sin subproyecto, se
 *   considera un DATO INVÁLIDO: se descarta del árbol y se
 *   registra un warning en consola. La reparación es en origen
 *   (mock actualmente; Supabase cuando Tablero migre), nunca
 *   aquí.
 *
 * Estado de migración:
 * - Tablero es el ÚLTIMO módulo pendiente de migrar a Supabase.
 *   Crear tarea, FOCO y Calendar ya consumen Supabase.
 * - Hoy este servicio lee del mock vía la API síncrona
 *   `getAllTasks()` de taskService. La interfaz pública
 *   (`getAreaTree`, `getAreaBySlug`, `listAreas`) se mantendrá
 *   estable cuando el origen pase a Supabase.

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

function buildTree(): AreaNode[] {
  const tasks = getAllTasks();
  const areas = new Map<string, AreaNode>();

  for (const t of tasks) {
    const areaName = t.area?.trim();
    const proyectoName = t.proyecto?.trim();
    const subName = t.subproyecto?.trim();

    // Contrato arquitectónico: una tarea SIEMPRE pertenece a
    // Área + Proyecto + Subproyecto. Cualquier ausencia es dato
    // inválido y no se representa en el árbol.
    if (!areaName || !proyectoName || !subName) {
      if (typeof console !== "undefined") {
        console.warn(
          `[tableroService] Tarea inválida ignorada (falta área/proyecto/subproyecto): ${t.id} - ${t.titulo}`,
        );
      }
      continue;
    }

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

/** Devuelve el árbol completo. */
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

