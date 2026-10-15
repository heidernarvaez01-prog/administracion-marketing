CREATE TABLE IF NOT EXISTS public.meta_platform_daily (
  account_id text NOT NULL, campaign_id text NOT NULL DEFAULT '', fecha date NOT NULL,
  publisher_platform text NOT NULL DEFAULT '', platform_position text NOT NULL DEFAULT '',
  spend numeric NOT NULL DEFAULT 0, impressions bigint NOT NULL DEFAULT 0, clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0, leads bigint NOT NULL DEFAULT 0, messaging_conversations bigint NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, campaign_id, fecha, publisher_platform, platform_position)
);
CREATE TABLE IF NOT EXISTS public.meta_demographics_daily (
  account_id text NOT NULL, campaign_id text NOT NULL DEFAULT '', fecha date NOT NULL,
  age text NOT NULL DEFAULT '', gender text NOT NULL DEFAULT '',
  spend numeric NOT NULL DEFAULT 0, impressions bigint NOT NULL DEFAULT 0, clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0, leads bigint NOT NULL DEFAULT 0, messaging_conversations bigint NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, campaign_id, fecha, age, gender)
);
CREATE TABLE IF NOT EXISTS public.meta_geo_daily (
  account_id text NOT NULL, campaign_id text NOT NULL DEFAULT '', fecha date NOT NULL,
  country text NOT NULL DEFAULT '', region text NOT NULL DEFAULT '',
  spend numeric NOT NULL DEFAULT 0, impressions bigint NOT NULL DEFAULT 0, clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0, leads bigint NOT NULL DEFAULT 0, messaging_conversations bigint NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, campaign_id, fecha, country, region)
);
CREATE TABLE IF NOT EXISTS public.meta_ad_creatives (
  ad_id text PRIMARY KEY, account_id text NOT NULL,
  thumbnail_url text, image_url text, title text, body text, link_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_datos
  ADD COLUMN IF NOT EXISTS video_p25 bigint, ADD COLUMN IF NOT EXISTS video_p50 bigint,
  ADD COLUMN IF NOT EXISTS video_p75 bigint, ADD COLUMN IF NOT EXISTS video_p100 bigint;

GRANT SELECT ON public.meta_platform_daily, public.meta_demographics_daily, public.meta_geo_daily, public.meta_ad_creatives TO authenticated;
GRANT ALL ON public.meta_platform_daily, public.meta_demographics_daily, public.meta_geo_daily, public.meta_ad_creatives TO service_role;

ALTER TABLE public.meta_platform_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_demographics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_geo_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_creatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view allowed accounts" ON public.meta_platform_daily;
CREATE POLICY "view allowed accounts" ON public.meta_platform_daily FOR SELECT TO authenticated USING (public.can_view_account(account_id));
DROP POLICY IF EXISTS "view allowed accounts" ON public.meta_demographics_daily;
CREATE POLICY "view allowed accounts" ON public.meta_demographics_daily FOR SELECT TO authenticated USING (public.can_view_account(account_id));
DROP POLICY IF EXISTS "view allowed accounts" ON public.meta_geo_daily;
CREATE POLICY "view allowed accounts" ON public.meta_geo_daily FOR SELECT TO authenticated USING (public.can_view_account(account_id));
DROP POLICY IF EXISTS "view allowed accounts" ON public.meta_ad_creatives;
CREATE POLICY "view allowed accounts" ON public.meta_ad_creatives FOR SELECT TO authenticated USING (public.can_view_account(account_id));

CREATE INDEX IF NOT EXISTS meta_platform_daily_fecha_idx ON public.meta_platform_daily (fecha);
CREATE INDEX IF NOT EXISTS meta_demographics_daily_fecha_idx ON public.meta_demographics_daily (fecha);
CREATE INDEX IF NOT EXISTS meta_geo_daily_fecha_idx ON public.meta_geo_daily (fecha);

-- Totales por desglose. _kind: 'platform' | 'placement' | 'age' | 'gender' | 'age_gender' | 'country' | 'region'.
-- security invoker: RLS de las tablas limita a cuentas visibles. Gasto separado por moneda.
CREATE OR REPLACE FUNCTION public.meta_breakdown_totals(_kind text, _days integer DEFAULT 30, _client_id uuid DEFAULT NULL)
RETURNS TABLE(currency text, dim1 text, dim2 text, spend numeric, impressions numeric, clicks numeric, reach numeric, leads numeric, messaging_conversations numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  with anchor as (select least(coalesce(max(m.fecha), current_date - 1), current_date - 1) as d from public.meta_datos m),
  src as (
    select p.account_id, p.fecha, p.publisher_platform as d1,
           case when _kind = 'placement' then p.platform_position else '' end as d2,
           p.spend, p.impressions, p.clicks, p.reach, p.leads, p.messaging_conversations
    from public.meta_platform_daily p where _kind in ('platform','placement')
    union all
    select g.account_id, g.fecha,
           case when _kind = 'gender' then g.gender else g.age end,
           case when _kind = 'age_gender' then g.gender else '' end,
           g.spend, g.impressions, g.clicks, g.reach, g.leads, g.messaging_conversations
    from public.meta_demographics_daily g where _kind in ('age','gender','age_gender')
    union all
    select r.account_id, r.fecha, r.country,
           case when _kind = 'region' then r.region else '' end,
           r.spend, r.impressions, r.clicks, r.reach, r.leads, r.messaging_conversations
    from public.meta_geo_daily r where _kind in ('country','region')
  )
  select a.currency, s.d1, s.d2, sum(s.spend), sum(s.impressions), sum(s.clicks), sum(s.reach), sum(s.leads), sum(s.messaging_conversations)
  from src s join public.ad_accounts a on a.account_id = s.account_id
  left join public.client_accounts ca on ca.account_id = s.account_id, anchor an
  where s.fecha > an.d - _days and s.fecha <= an.d
    and (_client_id is null or ca.client_id = _client_id)
  group by a.currency, s.d1, s.d2
  order by sum(s.spend) desc nulls last
  limit 300;
$$;
GRANT EXECUTE ON FUNCTION public.meta_breakdown_totals(text, integer, uuid) TO authenticated;