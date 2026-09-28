-- ============================================================
-- Resúmenes diarios ("secretaria"): matutino, mediodía y vespertino.
--
-- El vespertino reutiliza las columnas existentes daily_summary_*.
-- Se agregan preferencias para el matutino y el de mediodía.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS morning_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS morning_summary_hour SMALLINT NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS morning_summary_minute SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS midday_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS midday_summary_hour SMALLINT NOT NULL DEFAULT 13,
  ADD COLUMN IF NOT EXISTS midday_summary_minute SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'morning_summary_hour_range') THEN
    ALTER TABLE public.notification_preferences
      ADD CONSTRAINT morning_summary_hour_range CHECK (morning_summary_hour BETWEEN 0 AND 23);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'morning_summary_minute_range') THEN
    ALTER TABLE public.notification_preferences
      ADD CONSTRAINT morning_summary_minute_range CHECK (morning_summary_minute BETWEEN 0 AND 59);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'midday_summary_hour_range') THEN
    ALTER TABLE public.notification_preferences
      ADD CONSTRAINT midday_summary_hour_range CHECK (midday_summary_hour BETWEEN 0 AND 23);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'midday_summary_minute_range') THEN
    ALTER TABLE public.notification_preferences
      ADD CONSTRAINT midday_summary_minute_range CHECK (midday_summary_minute BETWEEN 0 AND 59);
  END IF;
END $$;