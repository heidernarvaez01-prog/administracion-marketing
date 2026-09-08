
CREATE TABLE public.brand_briefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id text NOT NULL UNIQUE,
  account_name text,
  marca text,
  sitio_web text,
  necesidad_principal text,
  descripcion_proyecto text,
  mercado_objetivo text,
  publico_objetivo text,
  fundamentos_marca text,
  palabras_marca text,
  frases_marca text,
  valores_marca text,
  promesa_marca text,
  reasons_why text,
  personalidad_marca text,
  estilo_tono text,
  diferenciador text,
  insights text,
  elementos_marca text,
  benchmark text,
  presupuesto_campana numeric,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_briefs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_briefs TO authenticated;
GRANT ALL ON public.brand_briefs TO service_role;

ALTER TABLE public.brand_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view brand briefs" ON public.brand_briefs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert brand briefs" ON public.brand_briefs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update brand briefs" ON public.brand_briefs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete brand briefs" ON public.brand_briefs FOR DELETE USING (true);

CREATE TRIGGER update_brand_briefs_updated_at
BEFORE UPDATE ON public.brand_briefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
