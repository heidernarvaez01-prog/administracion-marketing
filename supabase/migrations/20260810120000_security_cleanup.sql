-- ============================================================
-- Security cleanup (P0):
-- 1) Move the token used by pg_cron -> net.http_post out of
--    plaintext migration SQL and into Supabase Vault (a
--    placeholder secret is created here; the real value must be
--    set afterward via `select vault.update_secret(...)`, NOT
--    committed to this file).
-- 2) Reschedule sync-windsor-meta-daily-3am to read the token
--    from Vault instead of a hardcoded JWT literal.
-- 3) Remove the two cron jobs that live only in the DB and were
--    never tracked by a migration: sync-meta-datos-daily (exact
--    duplicate of sync-windsor-meta-daily-3am) and
--    sync-sheet-hourly (orphaned — its target function,
--    sync-sheet-data, no longer exists).
-- ============================================================

-- 1) Placeholder secret — update its value right after this migration
--    runs (see deploy notes). Never put the real key in a migration file.
select vault.create_secret(
  'REPLACE_ME_VIA_vault.update_secret',
  'project_anon_key',
  'Anon key used by pg_cron jobs to invoke Edge Functions via net.http_post'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'project_anon_key'
);

-- 2) Reschedule sync-windsor-meta-daily-3am to pull the token from Vault.
select cron.unschedule('sync-windsor-meta-daily-3am')
where exists (select 1 from cron.job where jobname = 'sync-windsor-meta-daily-3am');

select cron.schedule(
  'sync-windsor-meta-daily-3am',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://nhxgjbsimvutglimzzcq.supabase.co/functions/v1/sync-meta-datos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'project_anon_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3) Drop the duplicate and orphaned cron jobs (both created ad-hoc via
--    the dashboard SQL editor, never tracked in a migration).
select cron.unschedule('sync-meta-datos-daily')
where exists (select 1 from cron.job where jobname = 'sync-meta-datos-daily');

select cron.unschedule('sync-sheet-hourly')
where exists (select 1 from cron.job where jobname = 'sync-sheet-hourly');
