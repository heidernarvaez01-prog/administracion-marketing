
-- 1) Restrict campaign_tracking and data_sources policies to authenticated role
DROP POLICY IF EXISTS "Users can create own campaigns" ON public.campaign_tracking;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaign_tracking;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaign_tracking;
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaign_tracking;

CREATE POLICY "Users can create own campaigns" ON public.campaign_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaign_tracking FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaign_tracking FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own campaigns" ON public.campaign_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can delete own sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can update own sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can view own sources" ON public.data_sources;

CREATE POLICY "Users can create own sources" ON public.data_sources FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON public.data_sources FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON public.data_sources FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own sources" ON public.data_sources FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2) Set fixed search_path on SECURITY DEFINER functions and revoke anon/public EXECUTE
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
