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
--
-- Nombres repetidos (no puede haber dos con el mismo nombre en un Área):
--  - Proyecto "OperativApp": se FUSIONAN los dos. Se conserva el de
--    Proyectos Profesionales y recibe las Etapas y Tareas del de la
--    panadería. Etapas con el mismo nombre se unen (sus tareas pasan a
--    la Etapa existente). El OperativApp de la panadería queda vacío y
--    archivado, junto con su Área.
--  - Cualquier otro Proyecto/Objetivo/Hábito repetido de la panadería
--    se renombra agregando " (Panadería)".
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
  v_src UUID;   -- OperativApp de la panadería (origen de la fusión)
  v_dst UUID;   -- OperativApp de Proyectos Profesionales (se conserva)
  r_stage RECORD;
  v_same_stage UUID;
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

  -- 5a) Fusión de "OperativApp"
  SELECT id INTO v_src FROM public.projects
  WHERE area_id = v_pan AND lower(btrim(name)) = 'operativapp' LIMIT 1;
  SELECT id INTO v_dst FROM public.projects
  WHERE area_id = v_pp AND lower(btrim(name)) = 'operativapp' LIMIT 1;

  IF v_src IS NOT NULL AND v_dst IS NOT NULL THEN
    -- Conservar visión y fecha objetivo del origen si el destino no las tiene
    UPDATE public.projects d
    SET vision_text = COALESCE(d.vision_text, s.vision_text),
        target_date = COALESCE(d.target_date, s.target_date)
    FROM public.projects s
    WHERE d.id = v_dst AND s.id = v_src;

    FOR r_stage IN SELECT id, name FROM public.subprojects WHERE project_id = v_src LOOP
      SELECT id INTO v_same_stage FROM public.subprojects
      WHERE project_id = v_dst AND lower(btrim(name)) = lower(btrim(r_stage.name))
      LIMIT 1;

      IF v_same_stage IS NOT NULL THEN
        -- Etapa con el mismo nombre: sus tareas pasan a la Etapa existente
        UPDATE public.tasks
        SET subproject_id = v_same_stage, area_id = v_pp, dimension_id = NULL
        WHERE subproject_id = r_stage.id;
        UPDATE public.subprojects SET archived_at = COALESCE(archived_at, now())
        WHERE id = r_stage.id;
      ELSE
        -- Etapa distinta: se mueve completa al OperativApp destino
        UPDATE public.subprojects SET project_id = v_dst WHERE id = r_stage.id;
      END IF;
    END LOOP;

    -- El OperativApp de la panadería queda vacío y archivado (no se mueve)
    UPDATE public.projects SET archived_at = COALESCE(archived_at, now()) WHERE id = v_src;
  ELSE
    v_src := NULL;
  END IF;

  -- 5b) Otros nombres repetidos: se renombran con " (Panadería)"
  UPDATE public.projects p SET name = p.name || ' (Panadería)'
  WHERE p.area_id = v_pan AND p.id IS DISTINCT FROM v_src
    AND EXISTS (SELECT 1 FROM public.projects q
                WHERE q.area_id = v_pp AND lower(q.name) = lower(p.name));
  UPDATE public.objectives o SET name = o.name || ' (Panadería)'
  WHERE o.area_id = v_pan
    AND EXISTS (SELECT 1 FROM public.objectives q
                WHERE q.area_id = v_pp AND lower(q.name) = lower(o.name));
  UPDATE public.habits h SET name = h.name || ' (Panadería)'
  WHERE h.area_id = v_pan
    AND EXISTS (SELECT 1 FROM public.habits q
                WHERE q.area_id = v_pp AND lower(q.name) = lower(h.name));

  -- 5c) Todo lo de la panadería → Proyectos Profesionales / "Panadería"
  --    (Área y Dimensión juntas; Etapas, Metas y registros viajan solos)
  UPDATE public.projects   SET area_id = v_pp, dimension_id = v_dim_pan
  WHERE area_id = v_pan AND id IS DISTINCT FROM v_src;
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
