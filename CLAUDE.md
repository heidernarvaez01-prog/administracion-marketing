# Apache 360 (proyecto Lovable "Administracion Marketing")

## Objetivo
Dashboard de marketing para clientes, con datos de Meta Ads vía Windsor.ai, actualizados a diario.
El cliente entra con login, ve solo sus cuentas y puede chatear con sus datos.
Empieza con un cliente, pero debe servir para varios, y un cliente puede tener VARIAS cuentas publicitarias.

## Proyecto y stack (verificado 2026-10-13)
- Lovable project id: bfd44a5e-ab54-4911-8fb5-a6a4aa1e4b53 (publicado, audiencia pública). Backend Supabase (Lovable Cloud).
- React + Vite + Tailwind + shadcn/ui. Plantilla Envato "Eclan v2.0" (HTML plano).
- **La interfaz que ve el cliente es Eclan HTML** (`public/eclan/xhtml/`) — ahí se construye todo lo nuevo.
  **React (`/app`) es la plataforma de auditoría original** (Ad-Audit-Platform) y se mantiene tal cual, sin cambios por ahora.
- Nombre del producto: "Apache 360".

## Lo que YA existe en la base (no duplicar)
- `meta_datos`: datos de Meta a nivel ANUNCIO y día (columnas en español: `fecha`, `total_cost`, `campaign_name`, ...).
  Llave natural de upsert: (plataforma, account_id, campaign_id, adset_id, ad_id, fecha). Hoy solo tiene la cuenta 204109401 (Kemmerling),
  con datos del 2026-08-11 al 2026-09-09 (desactualizado: no hay sync diario).
- `account_assignments` (user_id ↔ account_id), `user_roles` + `has_role()`, `audit_clients` (clientes del módulo de auditoría, con user_id dueño),
  más alert_*, notifications, weekly_reports, campaign_ai_insights, brand_briefs, etc.
- Edge Function `supabase/functions/sync-meta-datos/index.ts`: llama a la API REST de Windsor, upsert por lotes, `date_preset=last_30d`.
  PROBLEMA: `WINDSOR_ACCOUNTS = "204109401"` está hardcodeado (una sola cuenta). Usa el secret `WINDSOR_API_KEY`.
- No hay `pg_cron` disponible hoy (la relación `cron.job` no existe): el sync diario no está programado.

## Agregado el 2026-10-13 (ya aplicado en la base; migración versionada en supabase/migrations/20261013000000_clients_accounts_members.sql)
- `ad_accounts`: catálogo de cuentas (account_id, account_name, platform, currency, managed_by 'own'|'other_agency', agency_name, active).
  Seed de 7 cuentas de Meta. Propias: "Clínica Hacienda Metamorfosis" (es el cliente Ginecea) y "ApacheStudio Cuenta Publicitaria".
  Las otras 5 (Kemmerling, Aruba Wastewater, Scuba Lodge Lagun Beach, Dennys Curacao, Navigator Insurances) son de la agencia "The Lab" (`agency_name`).
- `client_accounts` (client_id → audit_clients.id, account_id): agrupa cuentas por cliente. UNIQUE(account_id): una cuenta pertenece a un solo cliente.
- `client_members` (client_id, user_id, role viewer|manager): usuarios-cliente con login.
- Vista `v_client_accounts` (security_invoker): cliente + sus cuentas.
- Funciones security definer: `is_client_member`, `is_client_owner`, `can_view_account`.
- Policies nuevas (aditivas): miembros ven su cliente en `audit_clients` y sus filas de `meta_datos`.
  Las policies existentes (admin / account_assignments) siguen intactas.
- Datos ya cargados: cliente "Ginecea" en `audit_clients` (dueño: el usuario admin) vinculado a la cuenta 945132301704574 en `client_accounts`.
  Existe además un cliente "Cliente Demo" del módulo de auditoría.
  Las cuentas de The Lab no tienen cliente asignado; no crear clientes para ellas sin que Heider lo pida.
- Usuarios de prueba ya creados (sin asignaciones todavía — ni `client_members` ni `agency_members`):
  `heider.narvaez01+viewer@gmail.com` y `heider.narvaez01+lab@gmail.com`.

## Modelo de acceso (3 niveles, aplicado y probado el 2026-10-13)
super admin (user_roles 'admin', SOLO Heider; ve todo) → agencias (agencies, agency_members con rol manager) → clientes (audit_clients.agency_id) con viewers (client_members).
- Agencias: ApacheStudio (propia: clientes Ginecea, ApacheStudio interno, Cliente Demo) y The Lab (5 clientes, uno por cuenta: Kemmerling, Aruba Wastewater, Scuba Lodge, Dennys Curacao, Navigator).
- Manager de agencia: ve todos los clientes de SU agencia, sus cuentas y datos; puede crear/quitar viewers (solo role='viewer') en clientes de su agencia. No adjunta cuentas ni crea managers.
- Viewer de cliente: ve solo las cuentas de su cliente.
- client_accounts y client_members con rol manager solo los modifica el super admin. El rol 'manager' de client_members queda sin uso.
- La pantalla del paso 4 NUNCA debe asignar el rol 'admin'. Plantillas de alta en supabase/manual/alta_cliente_o_cuenta.sql.
- Una cuenta nueva de Windsor NO aparece sola: hay que insertarla en ad_accounts.
- Corregido: antes el dueño de un audit_clients podía adjuntar cuentas/miembros; ya no.

## Regla de sincronización por cuenta (IMPLEMENTADA en `sync-meta-datos`, 2026-10-13)
Se sincronizan las 7 cuentas (propias y de The Lab), pero sin traer datos de cuentas que no tienen:
- `active = false` o `sync_mode = 'never'`: se omite por completo (ni siquiera sondeo).
- `sync_mode = 'always'`: sync completo siempre.
- `sync_mode = 'auto'` (default): sync completo (nivel anuncio) solo si `last_data_date` es de los últimos 30 días.
  Si no (cuenta "dormida", `last_data_date` null o viejo): NO se baja nivel anuncio; solo un SONDEO diario, en una sola llamada a Windsor para todas las
  cuentas dormidas a la vez (últimos 7 días, campos `account_id`, `date`, `spend`, `impressions`).
  Si el sondeo muestra `spend > 0` o `impressions > 0` en alguna: actualizar su `last_data_date` con la fecha más reciente con datos, y hacer sync completo
  de esa cuenta en la misma corrida (queda activa sola a partir de ahí).
- Ventana del sync completo: 7 días (`last_7d`) en el día a día; **35 días** (rango explícito `date_from`/`date_to`, no preset — no se pudo verificar que
  exista `last_35d` en Windsor) la primera vez que una cuenta corre, o cuando despierta del sondeo. El sync completo es **una llamada a Windsor por cuenta**
  (no agrupado), para que un fallo en una cuenta no tumbe a las demás y el conteo de filas quede por cuenta.
- Siempre actualizar `last_probe_at` en cada sondeo y, tras cada sync completo con datos, `last_data_date` = fecha más reciente con spend/impresiones (nunca
  retrocede).
- Cada corrida (una fila por cuenta y modo) se registra en `sync_runs`: `run_id`, `account_id`, `mode` (completo/sondeo), `window_days`, `rows`, `status`
  (ok/error), `error`, `started_at`, `finished_at`. Lógica pura y testeada en `supabase/functions/sync-meta-datos/sync-plan.ts`.
- **Verificado 2026-10-13 — primera corrida con la lógica nueva** (contra Windsor, filas en `meta_datos` coinciden en gasto y clics):
  - Completo con backfill de 35 días: Ginecea 33 filas, Kemmerling 2184, Scuba Lodge 124, Dennys Curacao 108. Las 4 con datos hasta 2026-10-12
    (`last_data_date = 2026-10-12`).
  - Solo sondeo (0 filas, sin actividad): ApacheStudio Cuenta Publicitaria, Aruba Wastewater, Navigator Insurances — `last_probe_at` actualizado.
  - `sync_runs` tiene filas repetidas por pruebas concurrentes durante la verificación; inofensivo (no afecta `ad_accounts` ni `meta_datos`, es solo
    historial de corridas).

## Dos carpetas de migraciones (no mezclar)
- `supabase/migrations/`: migraciones SQL que escribe Claude Code, versionadas, pensadas para el flujo manual descrito en "Forma de trabajar" (Heider las
  aplica él mismo en la base; Claude Code no tiene CLI de Supabase ni Deno en esta máquina, así que no puede aplicarlas ni desplegar funciones).
- `drizzle/migrations/`: migraciones que genera y gestiona **la propia herramienta de Lovable** (Drizzle), aplicadas automáticamente por Lovable al
  sincronizar. Aquí viven `0000_sync_locks.sql` (tabla `sync_locks` + RPCs `try_acquire_sync_lock`/`release_sync_lock`) y `0001_enable_pg_cron_pg_net.sql`
  (extensiones `pg_cron`/`pg_net`).
- **No mover archivos entre las dos carpetas.** Moverlos rompería el tracking de migraciones de la herramienta que las gestiona (Supabase CLI vs. Drizzle).

## Protección de `sync-meta-datos` (implementada por Lovable, 2026-10-13)
- La función sigue con `verify_jwt = false` en `config.toml` (necesario: el cron la llama sin JWT de usuario), pero ahora valida ella misma un secreto
  compartido: header `x-sync-secret` comparado en tiempo constante contra el secret de función `SYNC_CRON_SECRET`. Sin header válido → `401`.
- Candado de concurrencia (`sync_locks`, TTL 15 min): si ya hay una corrida viva, responde `409 already_running` en vez de arrancar otra.
- Con secreto+candado ok, responde `202 {accepted:true, run_id}` de inmediato y sincroniza en segundo plano (`EdgeRuntime.waitUntil`), liberando el
  candado al terminar (éxito o error).
- **Cron diario ACTIVO** (`sync-meta-datos-daily`, `supabase/manual/sync_meta_datos_cron.sql` corrido, 08:00 UTC vía `pg_net`, secreto leído de Vault).
  Prueba manual verificada: `202`, ~55 s, 4 cuentas completas ok, 3 dormidas sondeadas, candado liberado al terminar.

## Pendiente, en este orden
1. Primer cliente con acceso: Ginecea (decidido, hecho). Moneda: control para elegir `ad_accounts.currency` por cuenta, **dentro de Eclan**
   (pantalla "Clientes y Agencias" del paso 4 — no en React). Por ahora **no** se agrega columna de tasa de cambio ni UI para ella.
   **Ya llena** para 4 cuentas: Ginecea MXN; Kemmerling, Dennys Curacao y Scuba Lodge USD. En `null` (pendiente, se llena desde la UI nueva):
   ApacheStudio Cuenta Publicitaria, Aruba Wastewater, Navigator Insurances. La tasa de cambio se diseña cuando haga falta un total que mezcle
   monedas distintas. **Regla de diseño ya decidida para ese momento**: `meta_datos` se queda siempre en la moneda nativa de cada cuenta (nunca se
   convierte al escribir); la conversión, si hace falta, se hace al leer (vista o consulta), nunca al guardar el dato crudo.
2. ~~Cambiar `sync-meta-datos`...~~ **Hecho** (ver "Regla de sincronización por cuenta" arriba). `sync_runs` creada y versionada
   (`supabase/migrations/20261013000200_sync_runs.sql`).
3. ~~Programar el sync diario...~~ **Hecho** (ver "Protección de `sync-meta-datos`" arriba).
4. Pantalla "Clientes y Agencias" **dentro de Eclan** (`admin.html`, tab nuevo junto a "Equipo"): crear cliente, adjuntar cuentas, invitar
   managers/viewers (usa `agencies`, `agency_members`, `client_accounts` y `client_members`). En progreso.
5. Chat con datos: Edge Function que consulta solo cuentas permitidas por `can_view_account`, con herramientas, sin SQL libre.

## Windsor.ai (verificado)
- Conector `facebook`. Para el listado de campos que funciona en producción, ver `WINDSOR_FIELDS` en `sync-meta-datos`.
- `publisher_platform` NO se puede mezclar con campos `omni` ni de `ranking` (HTTP 400): desgloses por ubicación requieren un sync aparte.
- `date_preset=last_7d` no incluye hoy. `spend` viene en la moneda de cada cuenta: no sumar entre monedas distintas.
- `actions_lead` llega null los días sin leads. La métrica de conversaciones de mensajería (7d) cuenta conversaciones nuevas tras 7 días de inactividad.
- Cuentas de Meta conectadas: 945132301704574 Clínica Hacienda Metamorfosis (propia); 204109401 Kemmerling; 2684291158613901 ApacheStudio Cuenta Publicitaria;
  1113698094692963 Aruba Wastewater Sustainable Solutions; 1896865817699409 Scuba Lodge Lagun Beach; 1594220351715319 Dennys Curacao; 1081184397435545 Navigator Insurances.

## Seguridad (no negociable)
- La API key de Windsor solo en secrets de Supabase. Nunca en código, repo, logs ni chat. La service role key nunca llega al frontend.
- La app está publicada con audiencia pública: la protección de datos depende 100% de RLS. No dar acceso a ningún cliente sin probar con dos clientes de prueba que no ven datos del otro.
- Revisar que el registro abierto de usuarios no otorgue acceso a datos (un usuario sin vínculos no debe ver nada).

## Forma de trabajar
- Antes de cada paso, mostrar el plan y esperar OK. Un paso a la vez, commits pequeños.
- Cambios de base siempre como migraciones versionadas en supabase/migrations/. Si se aplican directo en la base, versionar el mismo SQL en el repo.
- Confirmación explícita antes de operaciones destructivas (DROP, DELETE masivo, reset).
- Si algo no está definido aquí, preguntar en vez de asumir.
