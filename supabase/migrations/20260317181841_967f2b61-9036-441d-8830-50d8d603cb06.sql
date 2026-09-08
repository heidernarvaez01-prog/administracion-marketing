
-- Create enum for lab_days options
CREATE TYPE public.lab_days_type AS ENUM ('mon_fri', 'mon_sat', 'all');

-- Create enum for platform
CREATE TYPE public.ad_platform AS ENUM ('meta', 'google', 'tiktok', 'linkedin', 'extra1', 'extra2');

-- Campaign tracking table
CREATE TABLE public.campaign_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.ad_platform NOT NULL,
  campaign_name TEXT NOT NULL,
  account_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  lab_days public.lab_days_type NOT NULL DEFAULT 'mon_fri',
  budget_approved NUMERIC(12,2) NOT NULL DEFAULT 0,
  programmed_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data sources config table
CREATE TABLE public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.ad_platform NOT NULL,
  csv_url TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT false,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE public.campaign_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign_tracking
CREATE POLICY "Users can view own campaigns" ON public.campaign_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own campaigns" ON public.campaign_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaign_tracking FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaign_tracking FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for data_sources
CREATE POLICY "Users can view own sources" ON public.data_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sources" ON public.data_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON public.data_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON public.data_sources FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_campaign_tracking_updated_at BEFORE UPDATE ON public.campaign_tracking FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
