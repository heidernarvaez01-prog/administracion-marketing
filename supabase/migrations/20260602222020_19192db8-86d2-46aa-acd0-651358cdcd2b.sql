-- Enable pg_cron and pg_net for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove previous schedule if exists
SELECT cron.unschedule('sync-windsor-meta-daily-3am')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-windsor-meta-daily-3am');

-- Schedule daily sync at 3:00 AM (UTC). Project tz is UTC; adjust if needed.
SELECT cron.schedule(
  'sync-windsor-meta-daily-3am',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhxgjbsimvutglimzzcq.supabase.co/functions/v1/sync-meta-datos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeGdqYnNpbXZ1dGdsaW16emNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjkyNzksImV4cCI6MjA4OTM0NTI3OX0.UOKNrGZ_roGJLrsJu6Kw1jevgN-Yl9Rtwr1QFW11g7Y'
    ),
    body := '{}'::jsonb
  );
  $$
);