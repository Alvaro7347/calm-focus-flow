
CREATE TABLE public.internal_config (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo service_role. Ningún grant para anon/authenticated.
GRANT ALL ON public.internal_config TO service_role;

ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
-- Sin políticas: cerrada al Data API. service_role bypasea RLS.

INSERT INTO public.internal_config (key, value)
VALUES ('push_dispatch_secret', 'ae8d30bf4062e7e9af2f2478129a4830edd4619e987b37c7d99405437194a02f')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
