-- ============ audit_clients ============
-- One client/brand per audit workspace. Each client owns its own set of
-- audit_records so audits never mix between clients.
CREATE TABLE public.audit_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_clients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_clients FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_clients TO authenticated;
GRANT ALL ON public.audit_clients TO service_role;

CREATE POLICY "Users view own audit clients"
  ON public.audit_clients FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own audit clients"
  ON public.audit_clients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own audit clients"
  ON public.audit_clients FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own audit clients"
  ON public.audit_clients FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_audit_clients_updated_at
  BEFORE UPDATE ON public.audit_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ audit_records.client_id ============
ALTER TABLE public.audit_records
  ADD COLUMN client_id uuid REFERENCES public.audit_clients(id) ON DELETE CASCADE;

CREATE INDEX idx_audit_records_client_id ON public.audit_records(client_id);

-- ============ Backfill ============
-- Existing audits keep working: every user with orphan records gets a
-- default "General" client and their records are assigned to it.
INSERT INTO public.audit_clients (user_id, name)
SELECT DISTINCT user_id, 'General'
FROM public.audit_records
WHERE client_id IS NULL;

UPDATE public.audit_records ar
SET client_id = ac.id
FROM public.audit_clients ac
WHERE ar.client_id IS NULL
  AND ac.user_id = ar.user_id
  AND ac.name = 'General';
