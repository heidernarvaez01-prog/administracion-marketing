-- ============================================================
-- Schedule the automated alert-dispatch run, reusing the same CRON_SECRET
-- / x-cron-secret convention weekly-report already relies on (see
-- supabase/functions/weekly-report/index.ts, Deno.env.get("CRON_SECRET")).
-- A single generated secret now authenticates every cron-triggered Edge
-- Function call in this project. This migration also brings
-- weekly-report-monday-7am under version control for the first time — it
-- previously existed only as an ad-hoc Dashboard cron job (see CLAUDE.md
-- §6, "Cron jobs activos").
--
-- After this migration runs, copy the generated value into the Edge
-- Function secret so both functions can verify it:
--
--   select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret';
--   supabase secrets set CRON_SECRET=<value returned above>
--
-- (If CRON_SECRET was already set to something else, this replaces it for
-- both weekly-report and alert-dispatch — both are rescheduled below to
-- send the new value, so nothing is left out of sync.)
-- ============================================================

select vault.create_secret(
  gen_random_uuid()::text,
  'cron_secret',
  'Shared secret pg_cron sends as x-cron-secret to authenticate cron-triggered Edge Function calls (alert-dispatch, weekly-report)'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'cron_secret'
);

-- ── alert-dispatch: new daily run ──────────────────────────────────────
select cron.unschedule('alert-dispatch-daily')
where exists (select 1 from cron.job where jobname = 'alert-dispatch-daily');

-- Runs daily at 08:00 UTC; alert-dispatch itself decides per-user whether
-- today is actually a send day (daily vs weekly/Monday notify_frequency).
select cron.schedule(
  'alert-dispatch-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://nhxgjbsimvutglimzzcq.supabase.co/functions/v1/alert-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── weekly-report: bring the existing Monday cron under version control ─
select cron.unschedule('weekly-report-monday-7am')
where exists (select 1 from cron.job where jobname = 'weekly-report-monday-7am');

select cron.schedule(
  'weekly-report-monday-7am',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := 'https://nhxgjbsimvutglimzzcq.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
