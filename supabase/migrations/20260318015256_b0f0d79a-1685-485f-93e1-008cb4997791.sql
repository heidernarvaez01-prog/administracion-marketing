
-- Create audit_records table for campaign budget audit configurations
CREATE TABLE public.audit_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id text NOT NULL,
  campaign_name text NOT NULL,
  presupuesto_total numeric NOT NULL DEFAULT 0,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  tipo_calendario text NOT NULL DEFAULT 'corridos' CHECK (tipo_calendario IN ('corridos', 'lun_vie', 'lun_sab')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_records ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own audit records" ON public.audit_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own audit records" ON public.audit_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audit records" ON public.audit_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own audit records" ON public.audit_records FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_audit_records_updated_at BEFORE UPDATE ON public.audit_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
