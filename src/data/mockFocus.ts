import type { Tarea } from "@/types/tarea";

export const tareasFoco: Tarea[] = [
  // Hoy
  { id: "h1", categoriaFoco: "hoy", horaInicio: "09:00", titulo: "Activación Paris", area: "Soundkeleles", proyecto: "Comercial" },
  { id: "h2", categoriaFoco: "hoy", horaInicio: "10:00", titulo: "Reunión Federico por aprobación", area: "Soundkeleles", proyecto: "Act. Mall", vencida: true },
  { id: "h3", categoriaFoco: "hoy", horaInicio: "11:00", titulo: "Definir flujo base de reparto a domicilio", area: "Panadería", proyecto: "Operaciones" },
  { id: "h4", categoriaFoco: "hoy", horaInicio: "15:00", titulo: "Preparar clase Marketing", area: "UNAB", proyecto: "Academia" },
  { id: "h5", categoriaFoco: "hoy", horaInicio: "16:00", titulo: "Planificar semana familiar", area: "Familia" },
  { id: "h6", categoriaFoco: "hoy", horaInicio: "17:00", titulo: "Revisar proveedores", area: "Panadería", proyecto: "Operaciones", vencida: true },

  // Esta semana
  { id: "s1", categoriaFoco: "esta_semana", diaEtiqueta: "Mié 2", titulo: "Informe inventario", area: "Panadería", proyecto: "Operaciones" },
  { id: "s2", categoriaFoco: "esta_semana", diaEtiqueta: "Mié 2", titulo: "Clase Marketing Estratégico", area: "UNAB", proyecto: "Academia" },
  { id: "s3", categoriaFoco: "esta_semana", diaEtiqueta: "Jue 3", titulo: "Definir plan de activación comercial", area: "Soundkeleles", proyecto: "Comercial" },
  { id: "s4", categoriaFoco: "esta_semana", diaEtiqueta: "Jue 3", titulo: "Validar prototipo UI", area: "Soundkeleles", proyecto: "Operaciones" },
  { id: "s5", categoriaFoco: "esta_semana", diaEtiqueta: "Vie 4", titulo: "Preparar alumnos trabajo grupal", area: "UNAB", proyecto: "Academia" },
  { id: "s6", categoriaFoco: "esta_semana", diaEtiqueta: "Vie 4", titulo: "Actividad física", area: "Salud" },
  { id: "s7", categoriaFoco: "esta_semana", diaEtiqueta: "Sáb 5", titulo: "Reunión familiar", area: "Familia" },

  // Esperando
  { id: "e1", categoriaFoco: "esperando", titulo: "Aprobación de Federico", area: "Soundkeleles", proyecto: "Comercial", subproyecto: "Activación Paris" },
  { id: "e2", categoriaFoco: "esperando", titulo: "Respuesta proveedor diseño material POP", area: "Panadería", proyecto: "Marketing" },
  { id: "e3", categoriaFoco: "esperando", titulo: "Información equipo UNAB para prototipo UI", area: "UNAB", proyecto: "Academia" },
  { id: "e4", categoriaFoco: "esperando", titulo: "Confirmación lugar evento Paris", area: "Soundkeleles", proyecto: "Activ. Paris" },
  { id: "e5", categoriaFoco: "esperando", titulo: "Datos clientes potenciales para campaña", area: "Soundkeleles", proyecto: "Marketing" },

  // Sin movimiento
  { id: "m1", categoriaFoco: "sin_movimiento", titulo: "Actualizar manual de procesos", area: "Operaciones", diasSinActividad: 12 },
  { id: "m2", categoriaFoco: "sin_movimiento", titulo: "Proyecto app interna", area: "Equipo", diasSinActividad: 9 },
  { id: "m3", categoriaFoco: "sin_movimiento", titulo: "Capacitación equipo ventas", area: "Comercial", diasSinActividad: 7 },
  { id: "m4", categoriaFoco: "sin_movimiento", titulo: "Revisión objetivos Q2", area: "Dirección", diasSinActividad: 6 },
];
