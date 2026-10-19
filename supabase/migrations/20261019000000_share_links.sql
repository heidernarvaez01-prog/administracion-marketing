create table if not exists public.share_links (
  token text primary key default encode(extensions.gen_random_bytes(24),'hex'),
  client_id uuid not null references public.audit_clients(id) on delete cascade,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.share_links enable row level security;
grant select, insert, update, delete on public.share_links to authenticated;
drop policy if exists "admin manages share links" on public.share_links;
create policy "admin manages share links" on public.share_links for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));