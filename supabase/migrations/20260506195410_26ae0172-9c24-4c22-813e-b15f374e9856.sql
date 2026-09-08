
DROP POLICY IF EXISTS "Users can view own audit records" ON public.audit_records;
DROP POLICY IF EXISTS "Users can update own audit records" ON public.audit_records;
DROP POLICY IF EXISTS "Users can delete own audit records" ON public.audit_records;
DROP POLICY IF EXISTS "Users can create own audit records" ON public.audit_records;

CREATE POLICY "Anyone can view audit records" ON public.audit_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audit records" ON public.audit_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update audit records" ON public.audit_records FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete audit records" ON public.audit_records FOR DELETE USING (true);
