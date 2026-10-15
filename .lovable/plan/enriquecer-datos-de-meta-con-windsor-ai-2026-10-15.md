# Enriquecer datos de Meta con Windsor.ai

Campos verificados en Windsor (conector `facebook`). Meta no deja mezclar desgloses entre sí ni con el nivel anuncio, así que cada vista nueva es una tabla y una llamada aparte, a nivel **campaña y día** (más liviano que nivel anuncio).

## Qué verás
1. **Facebook vs Instagram** (Analítica): gasto, clics, CTR y resultados por plataforma y por ubicación (Feed, Stories, Reels...).
2. **Edad y género** (Analítica): tabla/gráfico de rendimiento por rango de edad y sexo.
3. **Ciudad / región** (Analítica): ranking por país y región.
4. **Creativos y video** (Campañas / Analítica "Mejores anuncios"): miniatura del anuncio, título y texto, y embudo de video 25/50/75/100%.

## Detalles técnicos
- Tablas nuevas (migración en `supabase/migrations/`, RLS con `can_view_account`, solo lectura para viewer/manager):
  - `meta_platform_daily` (account_id, campaign_id, fecha, publisher_platform, platform_position, spend, impressions, clicks, reach, leads, conversaciones)
  - `meta_demographics_daily` (… age, gender, …)
  - `meta_geo_daily` (… country, region, …)
  - `meta_ad_creatives` (ad_id, thumbnail_url, image_url, title, body, link_url, updated_at) — un registro por anuncio, no por día.
  - Columnas nuevas en `meta_datos`: video_p25/p50/p75/p100.
- `sync-meta-datos`: tras el sync completo de cada cuenta activa, 3 llamadas extra (plataforma, demografía, geo) con la misma ventana (7 / 35 días) + creativos de los anuncios vistos. Cuentas dormidas: sin cambios (solo sondeo). Cada llamada se registra en `sync_runs` con su propio `mode`; si falla una, no tumba las demás.
- RPCs de lectura (security invoker) para totales por plataforma/edad/región; `windsor-metrics` las expone.
- Moneda: gasto siempre separado por moneda; clics/impresiones/leads se suman.
- Verificación: un solo sync manual, comparar totales con Windsor, revisar Analítica como admin y como viewer.

## Orden (un paso a la vez, con tu OK)
1. Base + sync. 2. Facebook vs Instagram. 3. Edad y género. 4. Región. 5. Creativos y video.
