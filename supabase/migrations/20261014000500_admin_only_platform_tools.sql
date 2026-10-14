-- Herramientas de la plataforma: escritura SOLO para admin (ya aplicado en la base el 2026-10-14; idempotente).
-- Antes, cualquier usuario autenticado (incluidos viewers y managers) podia crear/editar/borrar sus propias
-- filas en estas tablas (reglas de alerta, canales de notificacion, auditorias, briefs, clusters, reportes...).
-- La lectura NO cambia. Los usuarios de cliente/agencia solo leen datos por las policies de SELECT.
do $$
declare
  r record;
  adm text := 'public.has_role(auth.uid(), ''admin''::app_role)';
begin
  for r in
    select * from (values
      ('alert_events','Users delete own alert events','DELETE'),
      ('alert_events','Users insert own alert events','INSERT'),
      ('alert_events','Users update own alert events','UPDATE'),
      ('alert_rules','Users delete own alert rules','DELETE'),
      ('alert_rules','Users insert own alert rules','INSERT'),
      ('alert_rules','Users update own alert rules','UPDATE'),
      ('alert_settings','Users delete own alert settings','DELETE'),
      ('alert_settings','Users insert own alert settings','INSERT'),
      ('alert_settings','Users update own alert settings','UPDATE'),
      ('audit_records','Users delete own audit records','DELETE'),
      ('audit_records','Users insert own audit records','INSERT'),
      ('audit_records','Users update own audit records','UPDATE'),
      ('brand_briefs','Users delete own brand briefs','DELETE'),
      ('brand_briefs','Users insert own brand briefs','INSERT'),
      ('brand_briefs','Users update own brand briefs','UPDATE'),
      ('campaign_ai_insights','Users delete own AI insights','DELETE'),
      ('campaign_ai_insights','Users insert own AI insights','INSERT'),
      ('cluster_runs','Users delete own cluster runs','DELETE'),
      ('cluster_runs','Users insert own cluster runs','INSERT'),
      ('cluster_runs','Users update own cluster runs','UPDATE'),
      ('notification_channels','Users delete own notification channels','DELETE'),
      ('notification_channels','Users insert own notification channels','INSERT'),
      ('notification_channels','Users update own notification channels','UPDATE'),
      ('weekly_reports','Users delete own weekly reports','DELETE'),
      ('weekly_reports','Users insert own weekly reports','INSERT'),
      ('weekly_reports','Users update own weekly reports','UPDATE')
    ) as t(tbl, pol, cmd)
  loop
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (auth.uid() = user_id and %s)', r.pol, r.tbl, adm);
    elsif r.cmd = 'DELETE' then
      execute format('alter policy %I on public.%I using (auth.uid() = user_id and %s)', r.pol, r.tbl, adm);
    else
      execute format('alter policy %I on public.%I using (auth.uid() = user_id and %s) with check (auth.uid() = user_id and %s)', r.pol, r.tbl, adm, adm);
    end if;
  end loop;
end $$;

-- audit_clients: la policy "Admins manage all audit clients" ya cubre al admin.
drop policy if exists "Users insert own audit clients" on public.audit_clients;
drop policy if exists "Users update own audit clients" on public.audit_clients;
drop policy if exists "Users delete own audit clients" on public.audit_clients;

-- presenter_notes tenia acceso TOTAL para el rol publico (cualquiera en internet podia leer y escribir).
drop policy if exists "Allow all access to presenter_notes" on public.presenter_notes;
drop policy if exists "Admins manage presenter_notes" on public.presenter_notes;
create policy "Admins manage presenter_notes" on public.presenter_notes for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));
