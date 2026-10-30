-- Compatible finance schema: user ownership uses plain UUIDs, not foreign keys to auth.users.
CREATE TABLE IF NOT EXISTS public.finance_settings (
  user_id UUID PRIMARY KEY DEFAULT auth.uid(),
  currency TEXT NOT NULL DEFAULT 'CLP',
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own rows" ON public.finance_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.finance_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_categories_name_not_blank CHECK (length(btrim(name)) > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own rows" ON public.finance_categories FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX IF NOT EXISTS finance_categories_user_name_unique ON public.finance_categories (user_id, lower(name)) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  expected_amount BIGINT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT income_sources_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT income_sources_expected_positive CHECK (expected_amount IS NULL OR expected_amount > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_sources TO authenticated;
GRANT ALL ON public.income_sources TO service_role;
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own rows" ON public.income_sources FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX IF NOT EXISTS income_sources_user_name_unique ON public.income_sources (user_id, lower(name)) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.recurring_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_charges TO authenticated;
GRANT ALL ON public.recurring_charges TO service_role;
ALTER TABLE public.recurring_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own rows" ON public.recurring_charges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.finance_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_movements TO authenticated;
GRANT ALL ON public.finance_movements TO service_role;
ALTER TABLE public.finance_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own rows" ON public.finance_movements FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS finance_movements_user_date_idx ON public.finance_movements (user_id, occurred_on DESC);
CREATE UNIQUE INDEX IF NOT EXISTS finance_movements_recurring_once ON public.finance_movements (recurring_charge_id, occurred_on) WHERE recurring_charge_id IS NOT NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['finance_settings','finance_categories','income_sources','recurring_charges','finance_movements'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_set_updated_at', t);
  END LOOP;
END $$;