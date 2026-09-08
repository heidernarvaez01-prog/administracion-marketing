-- ============================================================
-- Two more fields confirmed against windsor.ai/data-field/facebook/
-- (the exact reference the account team pointed to, "Facebook Metricas y
-- dimensiones.pdf"): placement breakdown and the funnel step between click
-- and conversion.
-- ============================================================

ALTER TABLE public.meta_datos
  ADD COLUMN publisher_platform text,
  ADD COLUMN landing_page_views bigint;
