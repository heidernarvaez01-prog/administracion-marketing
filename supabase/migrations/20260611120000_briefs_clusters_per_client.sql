-- ============ brand_briefs per client ============
-- Briefs now belong to a client (audit_clients) so the brief, the real-time
-- audit and the AI projection clusters of each client are all linked together.
ALTER TABLE public.brand_briefs
  ADD COLUMN client_id uuid REFERENCES public.audit_clients(id) ON DELETE CASCADE;

-- account_id is no longer the primary link (kept for reference/back-compat)
ALTER TABLE public.brand_briefs ALTER COLUMN account_id DROP NOT NULL;

-- One brief per client (required for upsert ON CONFLICT client_id).
-- Plain unique index: legacy rows with NULL client_id never collide.
CREATE UNIQUE INDEX brand_briefs_client_id_key
  ON public.brand_briefs(client_id);

-- Backfill: attach each user's existing brief(s) to their "General" client.
-- If a user has several account-based briefs, only the most recent one is
-- linked (one brief per client); the rest remain accessible by account_id.
WITH ranked AS (
  SELECT b.id,
         ac.id AS client_id,
         ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY b.updated_at DESC) AS rn
  FROM public.brand_briefs b
  JOIN public.audit_clients ac
    ON ac.user_id = b.user_id AND ac.name = 'General'
  WHERE b.client_id IS NULL
)
UPDATE public.brand_briefs b
SET client_id = ranked.client_id
FROM ranked
WHERE b.id = ranked.id AND ranked.rn = 1;

-- ============ cluster_runs ============
-- Stores each AI projection cluster execution per client.
CREATE TABLE public.cluster_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.audit_clients(id) ON DELETE CASCADE,
  cluster_key text NOT NULL DEFAULT 'la_formula_v2',
  title text NOT NULL,
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('running', 'done', 'error')),
  output_html text,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_cluster_runs_client_id ON public.cluster_runs(client_id);

ALTER TABLE public.cluster_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cluster_runs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cluster_runs TO authenticated;
GRANT ALL ON public.cluster_runs TO service_role;

CREATE POLICY "Users view own cluster runs"
  ON public.cluster_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cluster runs"
  ON public.cluster_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cluster runs"
  ON public.cluster_runs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own cluster runs"
  ON public.cluster_runs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
