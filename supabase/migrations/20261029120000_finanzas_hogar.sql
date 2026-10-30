-- ============================================================
-- FINANZAS DEL HOGAR
--
-- Gestor de gastos personal (solo el hogar; los negocios quedan
-- fuera). Un solo usuario: cada fila es de quien la creó.
--
--   finance_settings     moneda y si ya hizo la bienvenida
--   finance_categories   categorías de gasto (editables)
--   income_sources       fuentes de ingreso (UNAB, UTEM, ukelele…),
--                        con monto esperado al mes opcional
--   recurring_charges    cargos fijos automáticos (ChatGPT, Canva…):
--                        monto, día de cobro, medio de pago
--   finance_movements    lo que pasa: gasto, ingreso o pago de tarjeta
--
-- Reglas:
-- - Gasto: con categoría y medio de pago ('debito' o 'credito').
-- - Ingreso: con fuente.
-- - Pago de tarjeta: salda la deuda; NO es gasto (no se cuenta dos veces).
-- - Un cargo fijo genera a lo más un movimiento por fecha (sin duplicados).
-- - Montos en pesos enteros, siempre positivos.
-- Seguridad: cada usuario solo ve y cambia lo suyo (RLS).
-- No toca ninguna tabla existente. Idempotente.
-- ============================================================

-- 1) Ajustes
CREATE TABLE IF NOT EXISTS public.finance_settings (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'CLP',
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Categorías
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_categories_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_categories_user_name_unique
  ON public.finance_categories (user_id, lower(name)) WHERE archived_at IS NULL;

-- 3) Fuentes de ingreso
CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expected_amount BIGINT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT income_sources_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT income_sources_expected_positive CHECK (expected_amount IS NULL OR expected_amount > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS income_sources_user_name_unique
  ON public.income_sources (user_id, lower(name)) WHERE archived_at IS NULL;

-- 4) Cargos fijos automáticos
CREATE TABLE IF NOT EXISTS public.recurring_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  day_of_month SMALLINT NOT NULL,
  category_id UUID REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'credito',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recurring_charges_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT recurring_charges_amount_positive CHECK (amount > 0),
  CONSTRAINT recurring_charges_day_valid CHECK (day_of_month BETWEEN 1 AND 31),
  CONSTRAINT recurring_charges_method_valid CHECK (payment_method IN ('debito', 'credito'))
);

-- 5) Movimientos
CREATE TABLE IF NOT EXISTS public.finance_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  amount BIGINT NOT NULL,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  income_source_id UUID REFERENCES public.income_sources(id) ON DELETE SET NULL,
  payment_method TEXT,
  recurring_charge_id UUID REFERENCES public.recurring_charges(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_movements_kind_valid CHECK (kind IN ('expense', 'income', 'card_payment')),
  CONSTRAINT finance_movements_amount_positive CHECK (amount > 0),
  CONSTRAINT finance_movements_method_valid CHECK (payment_method IS NULL OR payment_method IN ('debito', 'credito')),
  CONSTRAINT finance_movements_expense_fields CHECK (kind <> 'expense' OR payment_method IS NOT NULL),
  CONSTRAINT finance_movements_income_fields CHECK (kind <> 'income' OR (category_id IS NULL AND payment_method IS NULL)),
  CONSTRAINT finance_movements_card_fields CHECK (kind <> 'card_payment' OR (category_id IS NULL AND income_source_id IS NULL AND payment_method IS NULL))
);
CREATE INDEX IF NOT EXISTS finance_movements_user_date_idx
  ON public.finance_movements (user_id, occurred_on DESC);
-- Un cargo fijo, un movimiento por fecha (evita duplicar al registrar solo).
CREATE UNIQUE INDEX IF NOT EXISTS finance_movements_recurring_once
  ON public.finance_movements (recurring_charge_id, occurred_on) WHERE recurring_charge_id IS NOT NULL;

-- 6) Permisos y RLS: cada usuario, lo suyo.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['finance_settings','finance_categories','income_sources','recurring_charges','finance_movements']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Own rows" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Own rows" ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      t
    );
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_set_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t || '_set_updated_at', t
    );
  END LOOP;
END $$;
