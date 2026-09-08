-- ============ alert_rules ============
-- Per-user, per-rule-type threshold + enable/disable, replacing the
-- localStorage-only "disabledTypes" set in AlertsPage. rule_type matches
-- the AlertType union in supabase/functions/_shared/alert-engine.ts.
-- `threshold` / `secondary_threshold` meaning depends on rule_type — see
-- ALERT_THRESHOLD_FIELDS in that same module.
CREATE TABLE public.alert_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  rule_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  threshold numeric,
  secondary_threshold numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_type)
);

CREATE INDEX idx_alert_rules_user_id ON public.alert_rules(user_id);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.alert_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT ALL ON public.alert_rules TO service_role;

CREATE POLICY "Users view own alert rules"
  ON public.alert_rules FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alert rules"
  ON public.alert_rules FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alert rules"
  ON public.alert_rules FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own alert rules"
  ON public.alert_rules FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_alert_rules_updated_at
BEFORE UPDATE ON public.alert_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
