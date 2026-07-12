
-- =============================================================
-- PUSH SUBSCRIPTIONS
-- =============================================================
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  device_id TEXT,
  user_agent TEXT,
  platform TEXT,
  timezone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX push_subscriptions_user_active_idx
  ON public.push_subscriptions (user_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_select_own"
  ON public.push_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "push_subs_insert_own"
  ON public.push_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subs_update_own"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subs_delete_own"
  ON public.push_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- NOTIFICATION PREFERENCES
-- =============================================================
CREATE TABLE public.notification_preferences (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  event_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_summary_hour SMALLINT NOT NULL DEFAULT 18,
  daily_summary_minute SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_summary_hour_range CHECK (daily_summary_hour BETWEEN 0 AND 23),
  CONSTRAINT daily_summary_minute_range CHECK (daily_summary_minute BETWEEN 0 AND 59)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_select_own"
  ON public.notification_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notif_prefs_insert_own"
  ON public.notification_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notif_prefs_update_own"
  ON public.notification_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- NOTIFICATION DELIVERIES (idempotencia)
-- =============================================================
CREATE TABLE public.notification_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,           -- 'event_reminder' | 'daily_high_priority_summary'
  activity_id UUID,                          -- FK "suave" a tasks.id (nullable)
  logical_date DATE,                         -- para el resumen diario en zona local
  dedupe_key TEXT NOT NULL,                  -- clave idempotente
  status TEXT NOT NULL DEFAULT 'sent',       -- 'sent' | 'failed' | 'expired'
  attempt SMALLINT NOT NULL DEFAULT 1,
  error_summary TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_dedupe_unique UNIQUE (dedupe_key)
);

CREATE INDEX notification_deliveries_user_idx
  ON public.notification_deliveries (user_id, notification_type, sent_at DESC);

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Solo lectura del propio historial; escrituras son server-side (service_role).
CREATE POLICY "notif_deliveries_select_own"
  ON public.notification_deliveries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
