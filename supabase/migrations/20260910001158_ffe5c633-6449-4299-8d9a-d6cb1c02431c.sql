-- ============ alert_settings ============
CREATE TABLE IF NOT EXISTS public.alert_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  only_critical boolean NOT NULL DEFAULT false,
  notify_frequency text NOT NULL DEFAULT 'daily',
  email_recipients text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alert_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_settings TO authenticated;
GRANT ALL ON public.alert_settings TO service_role;
CREATE POLICY "Users view own alert settings" ON public.alert_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alert settings" ON public.alert_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alert settings" ON public.alert_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own alert settings" ON public.alert_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_alert_settings_updated_at BEFORE UPDATE ON public.alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ notification_channels ============
CREATE TABLE IF NOT EXISTS public.notification_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  channel_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_type)
);
CREATE INDEX IF NOT EXISTS idx_notification_channels_user_id ON public.notification_channels(user_id);
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_channels FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_channels TO authenticated;
GRANT ALL ON public.notification_channels TO service_role;
CREATE POLICY "Users view own notification channels" ON public.notification_channels FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notification channels" ON public.notification_channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notification channels" ON public.notification_channels FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notification channels" ON public.notification_channels FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_notification_channels_updated_at BEFORE UPDATE ON public.notification_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ notifications ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  severity text NOT NULL,
  campaign_name text NOT NULL,
  alert_type text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ campaign_ai_insights ============
CREATE TABLE IF NOT EXISTS public.campaign_ai_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.audit_clients(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  severity text NOT NULL,
  finding text NOT NULL,
  recommendation text NOT NULL,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_ai_insights_user_created ON public.campaign_ai_insights(user_id, created_at DESC);
ALTER TABLE public.campaign_ai_insights ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_ai_insights FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_ai_insights TO authenticated;
GRANT ALL ON public.campaign_ai_insights TO service_role;
CREATE POLICY "Users view own AI insights" ON public.campaign_ai_insights FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own AI insights" ON public.campaign_ai_insights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own AI insights" ON public.campaign_ai_insights FOR DELETE TO authenticated USING (auth.uid() = user_id);