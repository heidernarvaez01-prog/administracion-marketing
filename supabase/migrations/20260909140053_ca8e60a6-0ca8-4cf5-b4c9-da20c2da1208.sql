-- ============ helper ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============ roles ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ account_assignments ============
CREATE TABLE IF NOT EXISTS public.account_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id text NOT NULL,
  account_name text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, account_id, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_assignments TO authenticated;
GRANT ALL ON public.account_assignments TO service_role;
ALTER TABLE public.account_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own assignments" ON public.account_assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert assignments" ON public.account_assignments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update assignments" ON public.account_assignments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete assignments" ON public.account_assignments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_account_assignments_user ON public.account_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_account_assignments_account ON public.account_assignments(account_id);

-- ============ audit_clients ============
CREATE TABLE IF NOT EXISTS public.audit_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  looker_report_url text,
  looker_approved boolean NOT NULL DEFAULT false,
  report_recipients text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_clients FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_clients TO authenticated;
GRANT ALL ON public.audit_clients TO service_role;
CREATE POLICY "Users view own audit clients" ON public.audit_clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own audit clients" ON public.audit_clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own audit clients" ON public.audit_clients FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own audit clients" ON public.audit_clients FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_audit_clients_updated_at BEFORE UPDATE ON public.audit_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ audit_records ============
CREATE TABLE IF NOT EXISTS public.audit_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.audit_clients(id) ON DELETE CASCADE,
  account_id text,
  platform text,
  campaign_name text NOT NULL,
  presupuesto_total numeric NOT NULL DEFAULT 0,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  tipo_calendario text NOT NULL DEFAULT 'corridos' CHECK (tipo_calendario IN ('corridos','lun_vie','lun_sab')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_records_client_id ON public.audit_records(client_id);
ALTER TABLE public.audit_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_records TO authenticated;
GRANT ALL ON public.audit_records TO service_role;
CREATE POLICY "Users view own audit records" ON public.audit_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own audit records" ON public.audit_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own audit records" ON public.audit_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own audit records" ON public.audit_records FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_audit_records_updated_at BEFORE UPDATE ON public.audit_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ meta_datos ============
CREATE TABLE IF NOT EXISTS public.meta_datos (
  id bigserial PRIMARY KEY,
  plataforma text NOT NULL DEFAULT 'META',
  account_id text,
  account_name text,
  campaign_name text,
  campaign_id text,
  objective text,
  adset_name text,
  adset_id text,
  ad_id text,
  ad_name text,
  optimization_goal text,
  publisher_platform text,
  fecha date,
  campaign_start_date date,
  campaign_end_date date,
  adset_start_date date,
  adset_end_date date,
  campaign_lifetime_budget numeric,
  daily_budget numeric,
  budget_remaining numeric,
  adset_lifetime_budget numeric,
  adset_daily_budget numeric,
  adset_budget_remaining numeric,
  total_cost numeric,
  cpc numeric,
  cpm numeric,
  frequency numeric,
  ctr_all numeric,
  clicks bigint,
  reach bigint,
  impressions bigint,
  thruplay_actions bigint,
  link_clicks integer,
  interactions integer,
  conversions numeric,
  purchases numeric,
  add_to_cart numeric,
  initiate_checkout numeric,
  purchase_value numeric,
  lead_value numeric,
  purchase_roas numeric,
  website_purchase_roas numeric,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  unique_clicks bigint,
  unique_ctr numeric,
  landing_page_views bigint,
  platform_specific jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_datos_natural_key UNIQUE (plataforma, account_id, campaign_id, adset_id, ad_id, fecha)
);
CREATE INDEX IF NOT EXISTS idx_meta_datos_campaign_id ON public.meta_datos(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_datos_ad_id ON public.meta_datos(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_datos_fecha ON public.meta_datos(fecha);
ALTER TABLE public.meta_datos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_datos FROM anon;
GRANT SELECT ON public.meta_datos TO authenticated;
GRANT ALL ON public.meta_datos TO service_role;
CREATE POLICY "Users read assigned meta_datos" ON public.meta_datos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.account_assignments a WHERE a.user_id = auth.uid() AND a.account_id = meta_datos.account_id)
  );

-- ============ brand_briefs ============
CREATE TABLE IF NOT EXISTS public.brand_briefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.audit_clients(id) ON DELETE CASCADE,
  account_id text,
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
  presupuesto_campana text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_briefs_client_id_key ON public.brand_briefs(client_id);
ALTER TABLE public.brand_briefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_briefs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_briefs TO authenticated;
GRANT ALL ON public.brand_briefs TO service_role;
CREATE POLICY "Users view own brand briefs" ON public.brand_briefs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own brand briefs" ON public.brand_briefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own brand briefs" ON public.brand_briefs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own brand briefs" ON public.brand_briefs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_brand_briefs_updated_at BEFORE UPDATE ON public.brand_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ cluster_runs ============
CREATE TABLE IF NOT EXISTS public.cluster_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.audit_clients(id) ON DELETE CASCADE,
  cluster_key text NOT NULL DEFAULT 'la_formula_v2',
  title text NOT NULL,
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('running','done','error')),
  output_html text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cluster_runs_client_id ON public.cluster_runs(client_id);
ALTER TABLE public.cluster_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cluster_runs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cluster_runs TO authenticated;
GRANT ALL ON public.cluster_runs TO service_role;
CREATE POLICY "Users view own cluster runs" ON public.cluster_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cluster runs" ON public.cluster_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cluster runs" ON public.cluster_runs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own cluster runs" ON public.cluster_runs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ weekly_reports ============
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.audit_clients(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  html text,
  sent_to text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_client_id ON public.weekly_reports(client_id);
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;
CREATE POLICY "Users view own weekly reports" ON public.weekly_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own weekly reports" ON public.weekly_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own weekly reports" ON public.weekly_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own weekly reports" ON public.weekly_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ alert_rules ============
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  rule_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  threshold numeric,
  secondary_threshold numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_type)
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON public.alert_rules(user_id);
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alert_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT ALL ON public.alert_rules TO service_role;
CREATE POLICY "Users view own alert rules" ON public.alert_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alert rules" ON public.alert_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alert rules" ON public.alert_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own alert rules" ON public.alert_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ alert_events ============
CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  campaign_name text NOT NULL,
  alert_type text NOT NULL,
  last_triggered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_name, alert_type)
);
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alert_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_events TO authenticated;
GRANT ALL ON public.alert_events TO service_role;
CREATE POLICY "Users view own alert events" ON public.alert_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alert events" ON public.alert_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alert events" ON public.alert_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own alert events" ON public.alert_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ bootstrap admin ============
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'heider.narvaez01@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;