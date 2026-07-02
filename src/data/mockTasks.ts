/**
 * ========================================================
 * Archivo: mockTasks
 *
 * LEGACY / BOOTSTRAP / DEVELOPMENT ONLY
 *
 * NO es fuente de datos del runtime de CalmApp. Todas las
 * pantallas (Crear tarea, FOCO, Calendar, Tablero) y el shell
 * de navegación (Sidebar, AreasDrawer) leen exclusivamente de
 * Supabase.
 *
 * Único consumidor: `seedService`, que utiliza esta estructura
 * como semilla al inicializar Supabase para un usuario nuevo
 * en entornos de desarrollo. No importar desde ningún otro
 * módulo. Se retirará cuando el bootstrap migre a semillas
 * SQL versionadas.
 * ========================================================
 */
import type { Tarea } from "@/types/tarea";


// Semana ancla del mock: lunes 29 jun - domingo 5 jul 2026.
const HOY = "2026-07-01"; // miércoles
const MIE = "2026-07-01";
const JUE = "2026-07-02";
const VIE = "2026-07-03";
const SAB = "2026-07-04";

export const tareasFoco: Tarea[] = [
  // Hoy
  { id: "h1", categoriaFoco: "hoy", fechaProgramada: HOY, horaInicio: "09:00", titulo: "Activación Paris", area: "Soundkeleles", proyecto: "Comercial", subproyecto: "Activación Paris" },
  { id: "h2", categoriaFoco: "hoy", fechaProgramada: HOY, horaInicio: "10:00", titulo: "Reunión Federico por aprobación", area: "Soundkeleles", proyecto: "Act. Mall", subproyecto: "Aprobaciones", vencida: true },
  { id: "h3", categoriaFoco: "hoy", fechaProgramada: HOY, horaInicio: "11:00", titulo: "Definir flujo base de reparto a domicilio", area: "Panadería", proyecto: "Operaciones", subproyecto: "Reparto a domicilio" },
  { id: "h4", categoriaFoco: "hoy", fechaProgramada: HOY, horaInicio: "15:00", titulo: "Preparar clase Marketing", area: "UNAB", proyecto: "Academia", subproyecto: "Marketing Estratégico" },
  { id: "h5", categoriaFoco: "hoy", fechaProgramada: HOY, horaInicio: "16:00", titulo: "Planificar semana familiar", area: "Familia", proyecto: "Planificación", subproyecto: "Semana familiar" },
  { id: "h6", categoriaFoco: "hoy", fechaProgramada: HOY, horaInicio: "17:00", titulo: "Revisar proveedores", area: "Panadería", proyecto: "Operaciones", subproyecto: "Proveedores", vencida: true },

  // Esta semana
  { id: "s1", categoriaFoco: "esta_semana", fechaProgramada: MIE, diaEtiqueta: "Mié 2", titulo: "Informe inventario", area: "Panadería", proyecto: "Operaciones", subproyecto: "Inventario" },
  { id: "s2", categoriaFoco: "esta_semana", fechaProgramada: MIE, diaEtiqueta: "Mié 2", titulo: "Clase Marketing Estratégico", area: "UNAB", proyecto: "Academia", subproyecto: "Marketing Estratégico" },
  { id: "s3", categoriaFoco: "esta_semana", fechaProgramada: JUE, diaEtiqueta: "Jue 3", titulo: "Definir plan de activación comercial", area: "Soundkeleles", proyecto: "Comercial", subproyecto: "Plan comercial" },
  { id: "s4", categoriaFoco: "esta_semana", fechaProgramada: JUE, diaEtiqueta: "Jue 3", titulo: "Validar prototipo UI", area: "Soundkeleles", proyecto: "Operaciones", subproyecto: "Prototipo UI" },
  { id: "s5", categoriaFoco: "esta_semana", fechaProgramada: VIE, diaEtiqueta: "Vie 4", titulo: "Preparar alumnos trabajo grupal", area: "UNAB", proyecto: "Academia", subproyecto: "Trabajo grupal" },
  { id: "s6", categoriaFoco: "esta_semana", fechaProgramada: VIE, diaEtiqueta: "Vie 4", titulo: "Actividad física", area: "Salud", proyecto: "Bienestar", subproyecto: "Actividad física" },
  { id: "s7", categoriaFoco: "esta_semana", fechaProgramada: SAB, diaEtiqueta: "Sáb 5", titulo: "Reunión familiar", area: "Familia", proyecto: "Encuentros", subproyecto: "Reuniones" },

  // Esperando (sin fecha: no aparecen en Calendar)
  { id: "e1", categoriaFoco: "esperando", titulo: "Aprobación de Federico", area: "Soundkeleles", proyecto: "Comercial", subproyecto: "Activación Paris" },
  { id: "e2", categoriaFoco: "esperando", titulo: "Respuesta proveedor diseño material POP", area: "Panadería", proyecto: "Marketing", subproyecto: "Material POP" },
  { id: "e3", categoriaFoco: "esperando", titulo: "Información equipo UNAB para prototipo UI", area: "UNAB", proyecto: "Academia", subproyecto: "Prototipo UI" },
  { id: "e4", categoriaFoco: "esperando", titulo: "Confirmación lugar evento Paris", area: "Soundkeleles", proyecto: "Activ. Paris", subproyecto: "Logística" },
  { id: "e5", categoriaFoco: "esperando", titulo: "Datos clientes potenciales para campaña", area: "Soundkeleles", proyecto: "Marketing", subproyecto: "Campañas" },

  // Sin movimiento (sin fecha: no aparecen en Calendar)
  { id: "m1", categoriaFoco: "sin_movimiento", titulo: "Actualizar manual de procesos", area: "Operaciones", proyecto: "Procesos", subproyecto: "Manual", diasSinActividad: 12 },
  { id: "m2", categoriaFoco: "sin_movimiento", titulo: "Proyecto app interna", area: "Equipo", proyecto: "Herramientas internas", subproyecto: "App interna", diasSinActividad: 9 },
  { id: "m3", categoriaFoco: "sin_movimiento", titulo: "Capacitación equipo ventas", area: "Comercial", proyecto: "Ventas", subproyecto: "Capacitación", diasSinActividad: 7 },
  { id: "m4", categoriaFoco: "sin_movimiento", titulo: "Revisión objetivos Q2", area: "Dirección", proyecto: "Estrategia", subproyecto: "Objetivos Q2", diasSinActividad: 6 },
];
