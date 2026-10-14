-- Endurecimiento (ya aplicado en la base el 2026-10-13; idempotente).
-- Un usuario que no es admin puede seguir creando/editando SUS clientes del modulo de auditoria,
-- pero ya no puede asignarles una agencia (agency_id): eso solo lo hace el super admin.
-- Sin esto, un viewer o manager que conociera el id de una agencia podia inyectar clientes en ella.
drop policy if exists "Users insert own audit clients" on public.audit_clients;
create policy "Users insert own audit clients" on public.audit_clients for insert to authenticated
  with check (auth.uid() = user_id and agency_id is null);

drop policy if exists "Users update own audit clients" on public.audit_clients;
create policy "Users update own audit clients" on public.audit_clients for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and agency_id is null);