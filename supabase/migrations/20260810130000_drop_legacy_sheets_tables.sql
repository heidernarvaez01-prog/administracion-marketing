-- ============================================================
-- Drop tables left over from the Google Sheets era, fully superseded by
-- Windsor.ai + meta_datos. Confirmed unused: no references anywhere in
-- src/ or supabase/functions/ (only auto-generated types.ts mentioned
-- them). See CLAUDE.md §10 P3 item 18.
-- ============================================================

DROP TABLE IF EXISTS public.data_sources;
DROP TABLE IF EXISTS public.campaign_tracking;
