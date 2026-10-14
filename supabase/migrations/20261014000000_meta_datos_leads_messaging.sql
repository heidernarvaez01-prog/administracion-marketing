-- Paso 1 (plan "Eclan presentable para clientes"): dos columnas de conteo
-- nuevas en meta_datos (leads, messaging_conversations, verificadas contra
-- Windsor a nivel de anuncio junto con los campos de ranking ya sincronizados,
-- sin HTTP 400) y una columna de "última sincronización" en ad_accounts, que
-- sync-meta-datos actualiza en cada corrida exitosa (a diferencia de
-- last_data_date, que solo avanza si hubo gasto/impresiones ese día).
-- Idempotente: puede correrse de nuevo sin fallar ni duplicar nada.

ALTER TABLE public.meta_datos
  ADD COLUMN IF NOT EXISTS leads bigint,
  ADD COLUMN IF NOT EXISTS messaging_conversations bigint;

ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
