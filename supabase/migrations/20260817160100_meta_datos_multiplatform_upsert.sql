-- ============================================================
-- Fase 1 of the multi-channel + agentic AI plan: replace sync-meta-datos's
-- delete-then-insert with a real upsert. Today's pattern
-- (`DELETE FROM meta_datos WHERE id >= 0` then bulk insert) is CLAUDE.md's
-- P0 AND a data-loss trap for the future: the day a second sync exists
-- (sync-google-datos, etc.), each Meta run would delete every platform's
-- rows, not just its own.
--
-- Natural key: (plataforma, account_id, campaign_id, adset_id, ad_id, fecha)
-- is unique per ad/day/platform. NOTE: this is a plain-column UNIQUE
-- constraint, not an expression index with coalesce() on the nullable ID
-- columns — PostgREST's upsert `on_conflict` parameter must name an actual
-- unique constraint/index by its literal columns; it can't target an
-- expression-based index. Windsor's facebook connector returns ad-level
-- rows (ad_id/adset_id/campaign_id are always populated for a "facebook"
-- request that includes those fields, which sync-meta-datos does), so in
-- practice these columns are never null on ingested rows — the NULL edge
-- case (if Windsor ever returns a row missing one of these) degrades to
-- "insert instead of merge" for that single row rather than a hard failure,
-- since Postgres treats each NULL as distinct for uniqueness purposes.
-- ============================================================

ALTER TABLE public.meta_datos
  ADD CONSTRAINT meta_datos_natural_key
  UNIQUE (plataforma, account_id, campaign_id, adset_id, ad_id, fecha);

-- Escape hatch for platform-specific metrics that don't have their own
-- column yet (e.g. a future Google Ads Quality Score) — avoids an
-- ALTER TABLE per new platform.
ALTER TABLE public.meta_datos
  ADD COLUMN platform_specific jsonb NOT NULL DEFAULT '{}'::jsonb;
