-- ============================================================
-- Reorganización de datos (pedida por el usuario):
--
--   Antes:
--     Área "Proyectos Profesionales" (ex Desarrollo, con su contenido)
--     Área de la panadería ("Panadería…")
--   Después:
--     Área "Proyectos Profesionales"
--     ├── Dimensión "Desarrollo" ← lo que ya estaba en el Área y no
--     │                            tenía Dimensión
--     └── Dimensión "Panadería"  ← todo lo del Área de la panadería
--
-- Se mueven Proyectos (con Etapas), Objetivos (con Metas), Hábitos
-- (con registros) y Tareas, incluidos los archivados (historial).
-- Lo que en "Proyectos Profesionales" YA tuviera Dimensión no se toca.
-- Nada se borra: el Área de la panadería queda ARCHIVADA y vacía, y
-- sus Dimensiones (si tenía) quedan archivadas.
--
-- Seguridad:
--  - Sólo actúa sobre la cuenta contacto@re-cuerda.cl.
--  - Exige exactamente 1 Área activa "Proyectos Profesionales" y
--    exactamente 1 Área activa cuyo nombre empiece con "Panader".
--    Si no, se detiene sin cambiar NADA.
--  - Una sola transacción: todo o nada. Idempotente.
-- ============================================================

DO $$
DECLARE
  v_owner UUID;
  v_pp UUID;
  v_pan UUID;
  v_pan_name TEXT;
  v_dim_dev UUID;
  v_dim_pan UUID;
  v_count INTEGER;
BEGIN
  -- 0) Cuenta del usuario dueño de los datos
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = 'contacto@re-cuerda.cl' LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'No se encontró la cuenta contacto@re-cuerda.cl. No se cambió nada.';
  END IF;

  -- 1) Área destino
  SELECT count(*) INTO v_count FROM public.areas
  WHERE user_id = v_owner AND archived_at IS NULL
    AND lower(btrim(name)) = 'proyectos profesionales';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 Área activa "Proyectos Profesionales" y hay %. No se cambió nada.', v_count;
  END IF;
  SELECT id INTO v_pp FROM public.areas
  WHERE user_id = v_owner AND archived_at IS NULL
    AND lower(btrim(name)) = 'proyectos profesionales';

  -- 2) Área de la panadería
  SELECT count(*) INTO v_count FROM public.areas
  WHERE user_id = v_owner AND archived_at IS NULL
    AND lower(btrim(name)) LIKE 'panader%';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 Área activa cuyo nombre empiece con "Panader" y hay %. No se cambió nada.', v_count;
  END IF;
  SELECT id, name INTO v_pan, v_pan_name FROM public.areas
  WHERE user_id = v_owner AND archived_at IS NULL
    AND lower(btrim(name)) LIKE 'panader%';

  -- 3) Dimensiones destino (se reutilizan si ya existen)
  SELECT id INTO v_dim_dev FROM public.dimensions
  WHERE area_id = v_pp AND archived_at IS NULL AND lower(btrim(name)) = 'desarrollo' LIMIT 1;
  IF v_dim_dev IS NULL THEN
    INSERT INTO public.dimensions (area_id, name, display_order)
    VALUES (v_pp, 'Desarrollo', 0) RETURNING id INTO v_dim_dev;
  END IF;

  SELECT id INTO v_dim_pan FROM public.dimensions
  WHERE area_id = v_pp AND archived_at IS NULL AND lower(btrim(name)) = 'panadería' LIMIT 1;
  IF v_dim_pan IS NULL THEN
    INSERT INTO public.dimensions (area_id, name, display_order)
    VALUES (v_pp, 'Panadería', 1) RETURNING id INTO v_dim_pan;
  END IF;

  -- 4) Lo que ya estaba en Proyectos Profesionales SIN Dimensión → "Desarrollo"
  UPDATE public.projects   SET dimension_id = v_dim_dev WHERE area_id = v_pp AND dimension_id IS NULL;
  UPDATE public.objectives SET dimension_id = v_dim_dev WHERE area_id = v_pp AND dimension_id IS NULL;
  UPDATE public.habits     SET dimension_id = v_dim_dev WHERE area_id = v_pp AND dimension_id IS NULL;
  UPDATE public.tasks      SET dimension_id = v_dim_dev
  WHERE area_id = v_pp AND dimension_id IS NULL
    AND subproject_id IS NULL AND goal_id IS NULL AND habit_id IS NULL;

  -- 5) Todo lo de la panadería → Proyectos Profesionales / "Panadería"
  --    (Área y Dimensión juntas; Etapas, Metas y registros viajan solos)
  UPDATE public.projects   SET area_id = v_pp, dimension_id = v_dim_pan WHERE area_id = v_pan;
  UPDATE public.objectives SET area_id = v_pp, dimension_id = v_dim_pan WHERE area_id = v_pan;
  UPDATE public.habits     SET area_id = v_pp, dimension_id = v_dim_pan WHERE area_id = v_pan;

  UPDATE public.tasks
  SET area_id = v_pp,
      dimension_id = CASE
        WHEN subproject_id IS NULL AND goal_id IS NULL AND habit_id IS NULL THEN v_dim_pan
        ELSE NULL
      END
  WHERE area_id = v_pan;

  -- 6) Archivar las Dimensiones que tuviera la panadería y el Área (vacía)
  UPDATE public.dimensions SET archived_at = now()
  WHERE area_id = v_pan AND archived_at IS NULL;
  UPDATE public.areas SET archived_at = now() WHERE id = v_pan;

  RAISE NOTICE 'Listo: "%" movida a Proyectos Profesionales / Panadería; contenido previo en Desarrollo.', v_pan_name;
END;
$$;
