CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DROP POLICY IF EXISTS "Permitir Borrar para sincronizacion" ON public.meta_datos;
CREATE POLICY "Permitir Borrar para sincronizacion"
ON public.meta_datos FOR DELETE
USING (true);