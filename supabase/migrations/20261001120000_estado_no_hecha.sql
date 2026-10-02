-- ============================================================
-- Nuevo estado de actividad: 'not_done' ("No la hice" / "No fui").
--
-- Registro honesto de que una tarea o evento no ocurrió, distinto de
-- archivar. Va en su propio archivo porque un valor nuevo de ENUM no
-- puede usarse en la misma transacción en que se crea.
-- ============================================================

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'not_done';
