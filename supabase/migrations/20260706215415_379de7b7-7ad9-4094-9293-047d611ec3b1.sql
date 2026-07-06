-- Add palette CHECK constraint to areas.color (same 12 slugs as projects).
-- Existing rows have color IS NULL, which the constraint permits and the app
-- treats as "sin color" (fallback DEFAULT_PROJECT_COLOR in projectIdentity.ts).
ALTER TABLE public.areas
  ADD CONSTRAINT areas_color_check
  CHECK (
    color IS NULL OR color = ANY (ARRAY[
      'calipso','azul','verde','morado','naranjo','amarillo',
      'rosa','gris','indigo','turquesa','coral','oliva'
    ]::text[])
  );