CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.sheet_sync_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT,
  account_name TEXT,
  campaign_name TEXT,
  adset_name TEXT,
  platform TEXT,
  date DATE,
  cost NUMERIC DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sheet_sync_data_campaign ON public.sheet_sync_data(campaign_name);
CREATE INDEX idx_sheet_sync_data_date ON public.sheet_sync_data(date);
CREATE INDEX idx_sheet_sync_data_platform ON public.sheet_sync_data(platform);

ALTER TABLE public.sheet_sync_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sheet sync data"
  ON public.sheet_sync_data FOR SELECT
  USING (true);

CREATE TABLE public.sheet_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rows_inserted INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT
);

ALTER TABLE public.sheet_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sync log"
  ON public.sheet_sync_log FOR SELECT
  USING (true);