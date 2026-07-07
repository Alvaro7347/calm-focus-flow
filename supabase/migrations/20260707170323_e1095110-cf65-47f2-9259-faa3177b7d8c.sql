CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS urp_set_updated_at ON public.user_research_profiles;
CREATE TRIGGER urp_set_updated_at
BEFORE UPDATE ON public.user_research_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();