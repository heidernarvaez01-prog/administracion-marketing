-- Modelo de 3 niveles: super admin (user_roles 'admin') -> agencias (managers) -> clientes (viewers).
-- Ya aplicada en la base el 2026-10-13 y probada con usuarios simulados. Idempotente.
-- También CORRIGE un fallo de seguridad de la migración 20261013000000: el "dueño" de un cliente podía
-- adjuntar cuentas y miembros, lo que permitía a cualquier usuario registrado enlazar una cuenta ajena.

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'manager' check (role in ('manager')),
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

alter table public.audit_clients add column if not exists agency_id uuid references public.agencies(id) on delete set null;

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;

create or replace function public.is_agency_manager(_agency_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _agency_id is not null and exists (select 1 from public.agency_members where agency_id = _agency_id and user_id = auth.uid());
$$;

create or replace function public.is_client_agency_manager(_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.audit_clients c join public.agency_members am on am.agency_id = c.agency_id
                 where c.id = _client_id and am.user_id = auth.uid());
$$;

create or replace function public.can_view_account(_account_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin'::app_role)
    or exists (select 1 from public.account_assignments a where a.user_id = auth.uid() and a.account_id = _account_id)
    or exists (select 1 from public.client_accounts ca join public.client_members cm on cm.client_id = ca.client_id
               where ca.account_id = _account_id and cm.user_id = auth.uid())
    or exists (select 1 from public.client_accounts ca join public.audit_clients c on c.id = ca.client_id
               join public.agency_members am on am.agency_id = c.agency_id
               where ca.account_id = _account_id and am.user_id = auth.uid());
$$;

drop policy if exists "Admins manage agencies" on public.agencies;
create policy "Admins manage agencies" on public.agencies for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "Managers view own agency" on public.agencies;
create policy "Managers view own agency" on public.agencies for select to authenticated
  using (public.is_agency_manager(id));

drop policy if exists "Admins manage agency members" on public.agency_members;
create policy "Admins manage agency members" on public.agency_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "View own agency membership" on public.agency_members;
create policy "View own agency membership" on public.agency_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins manage all audit clients" on public.audit_clients;
create policy "Admins manage all audit clients" on public.audit_clients for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "Agency managers view agency clients" on public.audit_clients;
create policy "Agency managers view agency clients" on public.audit_clients for select to authenticated
  using (public.is_agency_manager(agency_id));

drop policy if exists "Owners and admins manage client accounts" on public.client_accounts;
drop policy if exists "Admins manage client accounts" on public.client_accounts;
create policy "Admins manage client accounts" on public.client_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "Agency managers view client accounts" on public.client_accounts;
create policy "Agency managers view client accounts" on public.client_accounts for select to authenticated
  using (public.is_client_agency_manager(client_id));

drop policy if exists "Owners and admins manage client members" on public.client_members;
drop policy if exists "Admins manage client members" on public.client_members;
create policy "Admins manage client members" on public.client_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "Agency managers manage viewers" on public.client_members;
create policy "Agency managers manage viewers" on public.client_members for all to authenticated
  using (role = 'viewer' and public.is_client_agency_manager(client_id))
  with check (role = 'viewer' and public.is_client_agency_manager(client_id));

drop policy if exists "Agency managers read agency meta_datos" on public.meta_datos;
create policy "Agency managers read agency meta_datos" on public.meta_datos for select to authenticated
  using (exists (select 1 from public.client_accounts ca join public.audit_clients c on c.id = ca.client_id
                 join public.agency_members am on am.agency_id = c.agency_id
                 where ca.account_id = meta_datos.account_id and am.user_id = auth.uid()));
