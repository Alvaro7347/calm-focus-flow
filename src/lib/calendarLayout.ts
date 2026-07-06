/**
 * ========================================================
 * Archivo: lib/calendarLayout
 *
 * Responsabilidad:
 * Encapsular la lógica de distribución visual de eventos de
 * calendario cuando varios ocurren en horarios solapados.
 * Esta capa NO conoce de CalmApp, ni de tareas, ni de
 * Google Calendar: recibe intervalos con `start`/`end` en
 * minutos y devuelve la asignación de "columnas" (carriles)
 * y el número total de carriles del clúster al que pertenecen.
 *
 * Al ser agnóstica del origen, es directamente reutilizable
 * cuando el calendario integre en el futuro:
 *   • eventos de Google Calendar
 *   • tareas recurrentes
 *   • bloques de tiempo generados por IA
 *
 * ---------- Algoritmo de detección de colisiones ----------
 *
 * Se aplica el algoritmo clásico de "sweep line" usado por
 * Google Calendar / Apple Calendar para pintar eventos que
 * se solapan:
 *
 * 1. Ordenar los eventos por `start` ascendente (desempate
 *    por `end` descendente, para que los más largos ocupen
 *    el primer carril y los cortos rellenen).
 *
 * 2. Agrupar en "clústeres" transitivos: dos eventos entran
 *    en el mismo clúster si alguno se solapa con otro del
 *    clúster (`start < clusterEnd`). Al abrir un evento cuyo
 *    `start >= clusterEnd`, se cierra el clúster anterior y
 *    se emiten sus resultados.
 *
 * 3. Dentro de cada clúster, asignación greedy de carril:
 *    para cada evento, se busca el carril de menor índice
 *    cuyo último evento terminó en `<= start`. Si no existe,
 *    se abre un carril nuevo.
 *
 * 4. `lanes` del clúster = número máximo de carriles
 *    simultáneos observado en el clúster. Ese valor se
 *    propaga a todos los eventos del clúster para que la
 *    UI calcule `width = 1 / lanes` y `left = lane / lanes`.
 *
 * Complejidad: O(n log n) por el orden inicial; el resto es
 * lineal. Determinístico y estable respecto al orden de
 * entrada tras el sort.
 * ========================================================
 */

export interface LayoutInput {
  /** Identificador único (opaco para esta capa). */
  id: string;
  /** Minutos desde 00:00 del día. */
  startMin: number;
  /** Minutos desde 00:00 del día. `end > start`. */
  endMin: number;
}

export interface LayoutResult {
  id: string;
  /** Índice de carril asignado (0-based). */
  lane: number;
  /** Total de carriles del clúster al que pertenece. */
  lanes: number;
}

/**
 * Devuelve, para cada evento, el carril asignado y cuántos
 * carriles simultáneos tiene su clúster.
 */
export function layoutDayEvents(items: LayoutInput[]): Map<string, LayoutResult> {
  const out = new Map<string, LayoutResult>();
  if (items.length === 0) return out;

  const sorted = [...items].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.endMin - a.endMin;
  });

  // Un clúster está compuesto por eventos transitivamente solapados.
  let clusterEnd = -Infinity;
  let clusterItems: Array<{ item: LayoutInput; lane: number }> = [];
  // `laneEnds[k]` = fin del último evento en el carril k del clúster actual.
  let laneEnds: number[] = [];

  const flush = () => {
    const total = laneEnds.length || 1;
    for (const { item, lane } of clusterItems) {
      out.set(item.id, { id: item.id, lane, lanes: total });
    }
    clusterItems = [];
    laneEnds = [];
  };

  for (const ev of sorted) {
    if (ev.startMin >= clusterEnd) {
      // No hay solape con el clúster previo: cerramos y arrancamos uno nuevo.
      flush();
      clusterEnd = ev.endMin;
    } else {
      clusterEnd = Math.max(clusterEnd, ev.endMin);
    }

    // Asignar el carril de menor índice disponible.
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(ev.endMin);
    } else {
      laneEnds[lane] = ev.endMin;
    }
    clusterItems.push({ item: ev, lane });
  }
  flush();
  return out;
}

/**
 * Calcula la máxima concurrencia (nº de eventos simultáneos)
 * observada en cada hora del rango [startHour, endHour) a lo
 * largo de un conjunto de eventos. Es la métrica que la UI usa
 * para decidir cuánto agrandar la altura de cada franja horaria.
 *
 * Un evento cuenta en la hora `h` si su intervalo [startMin, endMin)
 * solapa con [h*60, (h+1)*60). El cálculo se hace con un barrido
 * clásico de "delta events" en O(n log n).
 */
export function maxConcurrencyPerHour(
  items: LayoutInput[],
  startHour: number,
  endHour: number,
): number[] {
  const hours = Math.max(0, endHour - startHour);
  const result = new Array<number>(hours).fill(0);
  if (hours === 0) return result;

  for (let h = 0; h < hours; h++) {
    const hStart = (startHour + h) * 60;
    const hEnd = hStart + 60;
    // Filtramos eventos que tocan la franja y aplicamos sweep
    // recortando a los límites de la hora para no contar de más.
    const deltas: Array<[number, number]> = [];
    for (const ev of items) {
      if (ev.endMin <= hStart || ev.startMin >= hEnd) continue;
      const s = Math.max(ev.startMin, hStart);
      const e = Math.min(ev.endMin, hEnd);
      if (e <= s) continue;
      deltas.push([s, 1]);
      deltas.push([e, -1]);
    }
    deltas.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    let cur = 0;
    let max = 0;
    for (const [, d] of deltas) {
      cur += d;
      if (cur > max) max = cur;
    }
    result[h] = max;
  }
  return result;
}
