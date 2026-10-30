CREATE TABLE IF NOT EXISTS public.finance_plan (

  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  user_id UUID NOT NULL DEFAULT auth.uid(),

  month DATE NOT NULL,

  kind TEXT NOT NULL,

  income_source_id UUID REFERENCES public.income_sources(id) ON DELETE CASCADE,

  category_id UUID REFERENCES public.finance_categories(id) ON DELETE CASCADE,

  amount BIGINT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT finance_plan_month_first_day CHECK (EXTRACT(DAY FROM month) = 1),

  CONSTRAINT finance_plan_kind_valid CHECK (kind IN ('income', 'expense', 'card_payment')),

  CONSTRAINT finance_plan_amount_not_negative CHECK (amount >= 0),

  CONSTRAINT finance_plan_links CHECK (

    (kind = 'income' AND income_source_id IS NOT NULL AND category_id IS NULL)

    OR (kind = 'expense' AND category_id IS NOT NULL AND income_source_id IS NULL)

    OR (kind = 'card_payment' AND income_source_id IS NULL AND category_id IS NULL)

  )

);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_plan TO authenticated;

GRANT ALL ON public.finance_plan TO service_role;

ALTER TABLE public.finance_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own rows" ON public.finance_plan FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS finance_plan_one_cell ON public.finance_plan (

  user_id, month, kind,

  COALESCE(income_source_id, category_id, '00000000-0000-0000-0000-000000000000'::uuid)

);

CREATE TRIGGER finance_plan_set_updated_at BEFORE UPDATE ON public.finance_plan

  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();