-- Regla de sincronización por cuenta (ya aplicada en la base el 2026-10-13; idempotente).
-- sync_mode: 'auto' (sincroniza solo si hay datos recientes, si no solo "sondea"),
--            'always' (siempre sincroniza), 'never' (nunca).
alter table public.ad_accounts
  add column if not exists sync_mode text not null default 'auto',
  add column if not exists last_data_date date,
  add column if not exists last_probe_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ad_accounts_sync_mode_check') then
    alter table public.ad_accounts add constraint ad_accounts_sync_mode_check check (sync_mode in ('auto','always','never'));
  end if;
end $$;

-- Cuentas con gasto/impresiones en los últimos 30 días al 2026-10-13 (verificado con Windsor).
update public.ad_accounts set last_data_date = '2026-10-12'
 where account_id in ('945132301704574','204109401','1594220351715319','1896865817699409') and last_data_date is null;
