-- ============================================================
-- Reorganización de datos (pedida por el usuario):
--
--   Antes:  Área "UNAB"  y  Área "UTEM"
--   Después:
--     Área "Docencia" (color azul)
--     ├── Dimensión "UNAB"  ← todo lo que estaba en el Área UNAB
--     └── Dimensión "UTEM"  ← todo lo que estaba en el Área UTEM
--
-- Se mueven Proyectos (con sus Etapas), Objetivos (con sus Metas),
-- Hábitos (con sus registros) y Tareas, incluidos los archivados, para
-- conservar todo el historial. Nada se borra: las Áreas antiguas
-- quedan ARCHIVADAS y vacías.
--
-- Seguridad:
--  - Si no encuentra exactamente un Área "UNAB" y un Área "UTEM"
--    activas del mismo usuario, se detiene sin cambiar NADA.
--  - Todo ocurre en una sola transacción: o se aplica completo o no
--    se aplica.
--  - Idempotente: si "Docencia" o sus Dimensiones ya existen, las
--    reutiliza.
-- ============================================================

DO $$
DECLARE
  v_unab UUID;
  v_utem UUID;
  v_user UUID;
  v_user_utem UUID;
  v_order INTEGER;
  v_docencia UUID;
  v_dim_unab UUID;
  v_dim_utem UUID;
  v_count INTEGER;
BEGIN
  -- 1) Localizar las Áreas de origen (nombre exacto, sin distinguir mayúsculas)
  SELECT count(*) INTO v_count FROM public.areas
  WHERE archived_at IS NULL AND lower(btrim(name)) = 'unab';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 Área activa llamada "UNAB" y hay %. No se cambió nada.', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.areas
  WHERE archived_at IS NULL AND lower(btrim(name)) = 'utem';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 Área activa llamada "UTEM" y hay %. No se cambió nada.', v_count;
  END IF;

  SELECT id, user_id, display_order INTO v_unab, v_user, v_order
  FROM public.areas WHERE archived_at IS NULL AND lower(btrim(name)) = 'unab';

  SELECT id, user_id, LEAST(v_order, display_order) INTO v_utem, v_user_utem, v_order
  FROM public.areas WHERE archived_at IS NULL AND lower(btrim(name)) = 'utem';

  IF v_user <> v_user_utem THEN
    RAISE EXCEPTION 'Las Áreas UNAB y UTEM pertenecen a usuarios distintos. No se cambió nada.';
  END IF;

  -- 2) Área "Docencia" (azul), en la posición de la primera de las dos
  SELECT id INTO v_docencia FROM public.areas
  WHERE user_id = v_user AND archived_at IS NULL AND lower(btrim(name)) = 'docencia'
  LIMIT 1;
  IF v_docencia IS NULL THEN
    INSERT INTO public.areas (user_id, name, color, display_order)
    VALUES (v_user, 'Docencia', 'azul', v_order)
    RETURNING id INTO v_docencia;
  END IF;

  -- 3) Dimensiones "UNAB" y "UTEM" dentro de Docencia
  SELECT id INTO v_dim_unab FROM public.dimensions
  WHERE area_id = v_docencia AND archived_at IS NULL AND lower(btrim(name)) = 'unab' LIMIT 1;
  IF v_dim_unab IS NULL THEN
    INSERT INTO public.dimensions (area_id, name, display_order)
    VALUES (v_docencia, 'UNAB', 0) RETURNING id INTO v_dim_unab;
  END IF;

  SELECT id INTO v_dim_utem FROM public.dimensions
  WHERE area_id = v_docencia AND archived_at IS NULL AND lower(btrim(name)) = 'utem' LIMIT 1;
  IF v_dim_utem IS NULL THEN
    INSERT INTO public.dimensions (area_id, name, display_order)
    VALUES (v_docencia, 'UTEM', 1) RETURNING id INTO v_dim_utem;
  END IF;

  -- 4) Mover Proyectos, Objetivos y Hábitos (Área + Dimensión juntos).
  --    Etapas, Metas y registros de hábitos cuelgan de ellos y viajan solos.
  UPDATE public.projects   SET area_id = v_docencia, dimension_id = v_dim_unab WHERE area_id = v_unab;
  UPDATE public.projects   SET area_id = v_docencia, dimension_id = v_dim_utem WHERE area_id = v_utem;
  UPDATE public.objectives SET area_id = v_docencia, dimension_id = v_dim_unab WHERE area_id = v_unab;
  UPDATE public.objectives SET area_id = v_docencia, dimension_id = v_dim_utem WHERE area_id = v_utem;
  UPDATE public.habits     SET area_id = v_docencia, dimension_id = v_dim_unab WHERE area_id = v_unab;
  UPDATE public.habits     SET area_id = v_docencia, dimension_id = v_dim_utem WHERE area_id = v_utem;

  -- 5) Mover Tareas. Las directas (sin Proyecto, Meta ni Hábito) quedan
  --    como tareas directas de su Dimensión; las demás heredan la
  --    Dimensión de su Proyecto/Objetivo/Hábito.
  UPDATE public.tasks
  SET area_id = v_docencia,
      dimension_id = CASE
        WHEN subproject_id IS NULL AND goal_id IS NULL AND habit_id IS NULL THEN v_dim_unab
        ELSE NULL
      END
  WHERE area_id = v_unab;

  UPDATE public.tasks
  SET area_id = v_docencia,
      dimension_id = CASE
        WHEN subproject_id IS NULL AND goal_id IS NULL AND habit_id IS NULL THEN v_dim_utem
        ELSE NULL
      END
  WHERE area_id = v_utem;

  -- 6) Archivar las Áreas antiguas (vacías). No se borran.
  UPDATE public.areas SET archived_at = now() WHERE id IN (v_unab, v_utem);

  RAISE NOTICE 'Docencia creada/reutilizada (%). UNAB y UTEM movidas como Dimensiones y Áreas antiguas archivadas.', v_docencia;
END;
$$;
