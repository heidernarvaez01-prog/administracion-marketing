-- ============================================================
-- Expand meta_datos with the metrics sync-meta-datos now pulls from
-- Windsor (verified against https://windsor.ai/data-field/all/ for the
-- facebook connector, 2026-08-10): platform IDs for robust matching and
-- ad-level drill-down, real budget/schedule fields (previously requested
-- columns that were always null because Windsor was never asked for the
-- underlying fields), conversion depth (purchases/leads/ROAS instead of a
-- single generic "conversions"), and Meta's own ad-quality diagnostics.
-- ============================================================

ALTER TABLE public.meta_datos
  ADD COLUMN campaign_id text,
  ADD COLUMN adset_id text,
  ADD COLUMN ad_id text,
  ADD COLUMN ad_name text,
  ADD COLUMN optimization_goal text,
  ADD COLUMN adset_budget_remaining numeric,
  ADD COLUMN purchases numeric,
  ADD COLUMN add_to_cart numeric,
  ADD COLUMN initiate_checkout numeric,
  ADD COLUMN purchase_value numeric,
  ADD COLUMN lead_value numeric,
  ADD COLUMN purchase_roas numeric,
  ADD COLUMN website_purchase_roas numeric,
  ADD COLUMN quality_ranking text,
  ADD COLUMN engagement_rate_ranking text,
  ADD COLUMN conversion_rate_ranking text,
  ADD COLUMN unique_clicks bigint,
  ADD COLUMN unique_ctr numeric;

CREATE INDEX idx_meta_datos_campaign_id ON public.meta_datos(campaign_id);
CREATE INDEX idx_meta_datos_ad_id ON public.meta_datos(ad_id);
