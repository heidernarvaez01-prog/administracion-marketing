-- ============ meta_datos: new performance metrics ============
-- Synced from Windsor (Meta + Google Ads): link clicks, interactions
-- (post engagement) and conversions. Engagement rate is computed in-app.
ALTER TABLE public.meta_datos
  ADD COLUMN link_clicks integer,
  ADD COLUMN interactions integer,
  ADD COLUMN conversions numeric;

-- ============ audit_clients: Looker reporting + weekly report config ============
ALTER TABLE public.audit_clients
  ADD COLUMN looker_report_url text,
  ADD COLUMN looker_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN report_recipients text[] NOT NULL DEFAULT '{}';

-- ============ weekly_reports ============
-- Sunday-to-Sunday performance report per client, emailed on Mondays.
CREATE TABLE public.weekly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.audit_clients(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  html text,
  sent_to text[] NOT NULL DEFAULT '{}',
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_weekly_reports_client_id ON public.weekly_reports(client_id);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.weekly_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;

CREATE POLICY "Users view own weekly reports"
  ON public.weekly_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own weekly reports"
  ON public.weekly_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own weekly reports"
  ON public.weekly_reports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own weekly reports"
  ON public.weekly_reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ alert_events ============
-- Anti-spam registry: each alert fires once per campaign+type and stays
-- silent until the campaign state changes (cooldown handled in-app).
CREATE TABLE public.alert_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  campaign_name text NOT NULL,
  alert_type text NOT NULL,
  last_triggered_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_name, alert_type)
);

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.alert_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_events TO authenticated;
GRANT ALL ON public.alert_events TO service_role;

CREATE POLICY "Users view own alert events"
  ON public.alert_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alert events"
  ON public.alert_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alert events"
  ON public.alert_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own alert events"
  ON public.alert_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
