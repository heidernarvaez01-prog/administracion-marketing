-- ============ notification_channels ============
-- Pluggable alert delivery channels per user. channel_type today is
-- 'email' | 'slack_webhook' | 'generic_webhook' | 'in_app'; 'whatsapp' is a
-- planned future addition using the same shape (config jsonb holds
-- whatever that channel needs — recipients, webhook_url, phone id, etc.),
-- see supabase/functions/_shared/notify.ts.
CREATE TABLE public.notification_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  channel_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_type)
);

CREATE INDEX idx_notification_channels_user_id ON public.notification_channels(user_id);

ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notification_channels FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_channels TO authenticated;
GRANT ALL ON public.notification_channels TO service_role;

CREATE POLICY "Users view own notification channels"
  ON public.notification_channels FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notification channels"
  ON public.notification_channels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notification channels"
  ON public.notification_channels FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notification channels"
  ON public.notification_channels FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_notification_channels_updated_at
BEFORE UPDATE ON public.notification_channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: turn each user's existing alert_settings.email_recipients into
-- an 'email' channel row so nobody's saved recipients get lost.
INSERT INTO public.notification_channels (user_id, channel_type, config, enabled)
SELECT user_id, 'email', jsonb_build_object('recipients', to_jsonb(email_recipients)), enabled
FROM public.alert_settings
WHERE array_length(email_recipients, 1) > 0;

-- Every existing user also gets an 'in_app' channel, enabled by default,
-- so the notification bell has somewhere to write to immediately.
INSERT INTO public.notification_channels (user_id, channel_type, config, enabled)
SELECT user_id, 'in_app', '{}'::jsonb, true
FROM public.alert_settings;

-- ============ notifications ============
-- In-app notification center feed.
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  severity text NOT NULL,
  campaign_name text NOT NULL,
  alert_type text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notifications FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
