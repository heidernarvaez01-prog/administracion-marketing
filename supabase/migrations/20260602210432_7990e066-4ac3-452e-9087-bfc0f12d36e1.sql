
-- ============ audit_records ============
DROP POLICY IF EXISTS "Anyone can view audit records" ON public.audit_records;
DROP POLICY IF EXISTS "Anyone can insert audit records" ON public.audit_records;
DROP POLICY IF EXISTS "Anyone can update audit records" ON public.audit_records;
DROP POLICY IF EXISTS "Anyone can delete audit records" ON public.audit_records;

REVOKE ALL ON public.audit_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_records TO authenticated;
GRANT ALL ON public.audit_records TO service_role;

CREATE POLICY "Users view own audit records"
  ON public.audit_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own audit records"
  ON public.audit_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own audit records"
  ON public.audit_records FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own audit records"
  ON public.audit_records FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ brand_briefs ============
-- Backfill user_id from existing audit_records by account match (best effort)
UPDATE public.brand_briefs b
SET user_id = ar.user_id
FROM public.audit_records ar
WHERE b.user_id IS NULL
  AND (b.account_id = ar.account_id OR b.account_name = ar.account_id);

-- Delete any remaining orphan briefs with no resolvable owner (no data loss risk: same user app)
DELETE FROM public.brand_briefs WHERE user_id IS NULL;

ALTER TABLE public.brand_briefs ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS "Anyone can view brand briefs" ON public.brand_briefs;
DROP POLICY IF EXISTS "Anyone can insert brand briefs" ON public.brand_briefs;
DROP POLICY IF EXISTS "Anyone can update brand briefs" ON public.brand_briefs;
DROP POLICY IF EXISTS "Anyone can delete brand briefs" ON public.brand_briefs;

REVOKE ALL ON public.brand_briefs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_briefs TO authenticated;
GRANT ALL ON public.brand_briefs TO service_role;

CREATE POLICY "Users view own brand briefs"
  ON public.brand_briefs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own brand briefs"
  ON public.brand_briefs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own brand briefs"
  ON public.brand_briefs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own brand briefs"
  ON public.brand_briefs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ meta_datos ============
-- Shared ad-performance data synced by the backend edge function (service_role).
-- Authenticated users may read; only service_role may write.
DROP POLICY IF EXISTS "Permitir Leer en Lovable" ON public.meta_datos;
DROP POLICY IF EXISTS "Permitir Insertar desde Google" ON public.meta_datos;
DROP POLICY IF EXISTS "Permitir Borrar para sincronizacion" ON public.meta_datos;

REVOKE ALL ON public.meta_datos FROM anon;
GRANT SELECT ON public.meta_datos TO authenticated;
GRANT ALL ON public.meta_datos TO service_role;

CREATE POLICY "Authenticated users read meta_datos"
  ON public.meta_datos FOR SELECT TO authenticated
  USING (true);
