-- Datos iniciales ya cargados en la base el 2026-10-13 (NO es migración: depende del uid del admin). Idempotente.
-- Admin / dueño de los clientes: 828f9557-065b-494b-aa84-ba8b14a5d436 (Heider)
insert into public.agencies (name) values ('ApacheStudio'), ('The Lab') on conflict (name) do nothing;

update public.audit_clients set agency_id = (select id from public.agencies where name = 'ApacheStudio')
 where name in ('Ginecea','Cliente Demo') and agency_id is null;

insert into public.audit_clients (user_id, name, agency_id)
select '828f9557-065b-494b-aa84-ba8b14a5d436', v.name, (select id from public.agencies where name = v.agency)
from (values ('ApacheStudio','ApacheStudio'),
             ('Kemmerling','The Lab'),
             ('Aruba Wastewater Sustainable Solutions','The Lab'),
             ('Scuba Lodge Lagun Beach','The Lab'),
             ('Dennys Curacao','The Lab'),
             ('Navigator Insurances','The Lab')) as v(name, agency)
where not exists (select 1 from public.audit_clients c where c.name = v.name);

insert into public.client_accounts (client_id, account_id)
select c.id, v.account_id
from (values ('ApacheStudio','2684291158613901'),
             ('Kemmerling','204109401'),
             ('Aruba Wastewater Sustainable Solutions','1113698094692963'),
             ('Scuba Lodge Lagun Beach','1896865817699409'),
             ('Dennys Curacao','1594220351715319'),
             ('Navigator Insurances','1081184397435545')) as v(name, account_id)
join public.audit_clients c on c.name = v.name
on conflict do nothing;
