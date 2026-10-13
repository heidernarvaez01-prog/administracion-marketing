-- Historial de corridas de sync-meta-datos: una fila por cuenta y modo.
-- Idempotente (se puede ejecutar más de una vez sin error ni duplicados).
--   mode:        'completo' (nivel anuncio) | 'sondeo' (una llamada ligera para cuentas dormidas)
--   window_days: 7 = sync diario, 35 = backfill (primera vez o cuenta que despierta), sondeo = 7
--   run_id:      agrupa todas las filas de una misma invocación de la función
-- Duración de cada corrida: finished_at - started_at.
-- Escribe SOLO la Edge Function (service role, que ignora RLS). Lee SOLO un admin.
-- Sin FK a ad_accounts a propósito: el historial sobrevive aunque se borre la cuenta.

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  account_id text not null,
  mode text not null check (mode in ('completo', 'sondeo')),
  window_days integer,
  rows integer,
  status text not null check (status in ('ok', 'error')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- "¿Esta cuenta ya tuvo un sync completo exitoso?" y consulta de historial por cuenta.
create index if not exists sync_runs_account_mode_status_idx
  on public.sync_runs (account_id, mode, status, started_at desc);
create index if not exists sync_runs_run_id_idx
  on public.sync_runs (run_id);

alter table public.sync_runs enable row level security;

-- La app está publicada con audiencia pública: la protección depende de RLS.
-- Solo SELECT para admins; sin policies de INSERT/UPDATE/DELETE => nadie más escribe.
drop policy if exists "Admins read sync_runs" on public.sync_runs;
create policy "Admins read sync_runs" on public.sync_runs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Defensa en profundidad además de RLS.
revoke all on public.sync_runs from anon;
revoke insert, update, delete, truncate on public.sync_runs from authenticated;
