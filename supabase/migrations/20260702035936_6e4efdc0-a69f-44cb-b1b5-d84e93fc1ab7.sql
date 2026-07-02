
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apellidos text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS week_starts_on smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'DD/MM/YYYY';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_week_starts_on_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_week_starts_on_check CHECK (week_starts_on IN (0, 1));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_profiles_updated_at'
  ) THEN
    CREATE TRIGGER set_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
