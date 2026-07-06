ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS color text
  CHECK (
    color IS NULL OR color IN (
      'calipso','azul','verde','morado','naranjo','amarillo',
      'rosa','gris','indigo','turquesa','coral','oliva'
    )
  );

COMMENT ON COLUMN public.projects.color IS
  'Identidad visual del Proyecto (slug de la paleta CalmApp). NULL = color por defecto. Futuras extensiones (icono, emoji) irán como columnas adicionales.';