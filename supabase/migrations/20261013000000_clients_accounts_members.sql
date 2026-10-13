-- Agrupa cuentas publicitarias por cliente y permite acceso de usuarios-cliente.
-- Ya fue aplicada directamente en la base (Lovable Cloud) el 2026-10-13.
-- Este archivo la versiona en el repo para evitar drift. Es IDEMPOTENTE: si se ejecuta de nuevo
-- sobre una base que ya la tiene, no falla ni duplica nada.

create table if not exists public.ad_accounts (
  account_id text primary key,
  platform text not null default 'facebook',
  account_name text,
  currency text,
  managed_by text not null default 'own' check (managed_by in ('own','other_agency')),
  agency_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.client_accounts (
  client_id uuid not null references public.audit_clients(id) on delete cascade,
  account_id text not null references public.ad_accounts(account_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (client_id, account_id),
  unique (account_id)
);

create table if not exists public.client_members (
  client_id uuid not null references public.audit_clients(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'viewer' check (role in ('viewer','manager')),
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

alter table public.ad_accounts enable row level security;
alter table public.client_accounts enable row level security;
alter table public.client_members enable row level security;

create or replace function public.is_client_member(_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.client_members where client_id = _client_id and user_id = auth.uid());
$$;

create or replace function public.is_client_owner(_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.audit_clients where id = _client_id and user_id = auth.uid());
$$;

create or replace function public.can_view_account(_account_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin'::app_role)
    or exists (select 1 from public.account_assignments a where a.user_id = auth.uid() and a.account_id = _account_id)
    or exists (select 1 from public.client_accounts ca join public.client_members cm on cm.client_id = ca.client_id
               where ca.account_id = _account_id and cm.user_id = auth.uid())
    or exists (select 1 from public.client_accounts ca join public.audit_clients c on c.id = ca.client_id
               where ca.account_id = _account_id and c.user_id = auth.uid());
$$;

drop policy if exists "View visible ad accounts" on public.ad_accounts;
create policy "View visible ad accounts" on public.ad_accounts for select to authenticated
  using (public.can_view_account(account_id));
drop policy if exists "Admins manage ad accounts" on public.ad_accounts;
create policy "Admins manage ad accounts" on public.ad_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "View client accounts" on public.client_accounts;
create policy "View client accounts" on public.client_accounts for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.is_client_member(client_id) or public.is_client_owner(client_id));
drop policy if exists "Owners and admins manage client accounts" on public.client_accounts;
create policy "Owners and admins manage client accounts" on public.client_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.is_client_owner(client_id))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.is_client_owner(client_id));

drop policy if exists "View client members" on public.client_members;
create policy "View client members" on public.client_members for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role) or public.is_client_owner(client_id));
drop policy if exists "Owners and admins manage client members" on public.client_members;
create policy "Owners and admins manage client members" on public.client_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.is_client_owner(client_id))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.is_client_owner(client_id));

drop policy if exists "Members view their clients" on public.audit_clients;
create policy "Members view their clients" on public.audit_clients for select to authenticated
  using (public.is_client_member(id));

drop policy if exists "Client members read client meta_datos" on public.meta_datos;
create policy "Client members read client meta_datos" on public.meta_datos for select to authenticated
  using (exists (select 1 from public.client_accounts ca join public.client_members cm on cm.client_id = ca.client_id
                 where ca.account_id = meta_datos.account_id and cm.user_id = auth.uid()));

create or replace view public.v_client_accounts with (security_invoker = true) as
  select ca.client_id, c.name as client_name, a.account_id, a.account_name, a.platform, a.currency,
         a.managed_by, a.agency_name, a.active
  from public.client_accounts ca
  join public.audit_clients c on c.id = ca.client_id
  join public.ad_accounts a on a.account_id = ca.account_id;

insert into public.ad_accounts (account_id, platform, account_name, managed_by, agency_name) values
  ('945132301704574','facebook','Clínica Hacienda Metamorfosis','own',null),
  ('2684291158613901','facebook','ApacheStudio Cuenta Publicitaria','own',null),
  ('204109401','facebook','Kemmerling','other_agency','The Lab'),
  ('1113698094692963','facebook','Aruba Wastewater Sustainable Solutions','other_agency','The Lab'),
  ('1896865817699409','facebook','Scuba Lodge Lagun Beach','other_agency','The Lab'),
  ('1594220351715319','facebook','Dennys Curacao','other_agency','The Lab'),
  ('1081184397435545','facebook','Navigator Insurances','other_agency','The Lab')
on conflict (account_id) do update
  set account_name = excluded.account_name,
      managed_by = excluded.managed_by,
      agency_name = excluded.agency_name;
