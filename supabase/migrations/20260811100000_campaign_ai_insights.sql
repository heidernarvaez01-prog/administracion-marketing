-- ============ campaign_ai_insights ============
-- Free-form findings from the daily AI deep-scan (alert-dispatch): unlike
-- the 6 fixed alert rules, these come from an LLM comparing each
-- campaign's recent metrics (ROAS, CTR, CPM, frequency, Meta's quality
-- rankings) against its own trailing baseline, so it can flag deviations
-- nobody wrote a fixed rule for. Delivered through the same
-- notification_channels pipeline as regular alerts; persisted here too so
-- they're visible in-app without waiting for the next email/Slack digest.
CREATE TABLE public.campaign_ai_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.audit_clients(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  severity text NOT NULL, -- 'critical' | 'warning' | 'info'
  finding text NOT NULL,
  recommendation text NOT NULL,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_ai_insights_user_created
  ON public.campaign_ai_insights(user_id, created_at DESC);

ALTER TABLE public.campaign_ai_insights ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_ai_insights FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_ai_insights TO authenticated;
GRANT ALL ON public.campaign_ai_insights TO service_role;

CREATE POLICY "Users view own AI insights"
  ON public.campaign_ai_insights FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own AI insights"
  ON public.campaign_ai_insights FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own AI insights"
  ON public.campaign_ai_insights FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
