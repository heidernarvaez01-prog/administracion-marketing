-- Ejecutar a mano en el editor SQL (el agente no tiene acceso a Vault). Idempotente.
-- Requisito previo: guardar en Vault un secreto llamado 'sync_cron_secret' con el MISMO valor
-- que el secret SYNC_CRON_SECRET de las funciones, por ejemplo:
--   select vault.create_secret('<valor>', 'sync_cron_secret');   -- no versionar esa línea con el valor
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-meta-datos-daily') THEN
    PERFORM cron.unschedule('sync-meta-datos-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-meta-datos-daily',
  '0 8 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://szdivobcbdkiszgrizic.supabase.co/functions/v1/sync-meta-datos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sync_cron_secret' LIMIT 1)
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $job$
);
