-- PLANTILLAS DE ALTA (ejecutar a mano como admin en el editor SQL). Cambia solo lo que está entre < >.

-- 1) Cuenta nueva conectada en Windsor: registrarla en el catálogo (el sync lee ad_accounts, no Windsor).
insert into public.ad_accounts (account_id, platform, account_name, managed_by, agency_name, currency)
values ('<account_id de Windsor>', 'facebook', '<nombre de la cuenta>', 'other_agency', 'The Lab', '<USD|MXN|COP|...>');
-- managed_by: 'own' si es tuya (agency_name null) | 'other_agency' + agency_name si es de otra agencia.

-- 2) Cliente nuevo dentro de una agencia (ApacheStudio | The Lab):
insert into public.audit_clients (user_id, name, agency_id)
values ('828f9557-065b-494b-aa84-ba8b14a5d436', '<nombre del cliente>',
        (select id from public.agencies where name = '<ApacheStudio|The Lab>'));

-- 3) Vincular la cuenta al cliente (una cuenta pertenece a UN solo cliente):
insert into public.client_accounts (client_id, account_id)
values ((select id from public.audit_clients where name = '<nombre del cliente>'), '<account_id>');

-- 4) Dar acceso a un usuario (primero debe existir su login en la app):
--    Viewer de un cliente:
insert into public.client_members (client_id, user_id, role)
values ((select id from public.audit_clients where name = '<nombre del cliente>'),
        (select id from auth.users where email = '<correo>'), 'viewer');
--    Manager de una agencia (ve todos los clientes de esa agencia):
insert into public.agency_members (agency_id, user_id)
values ((select id from public.agencies where name = '<ApacheStudio|The Lab>'),
        (select id from auth.users where email = '<correo>'));
-- NUNCA insertes en user_roles con rol 'admin' para nadie que no seas tú: ese rol ve TODAS las cuentas.
