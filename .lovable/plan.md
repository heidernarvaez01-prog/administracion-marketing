# Campañas y Analítica con datos reales

Objetivo: que todo lo que se ve en estas dos páginas salga de los datos reales de Meta (los que se sincronizan a diario), respetando el cliente elegido en el Dashboard y la regla de monedas.

## Campañas (`compaign.html`)
- Encabezado: título "Campañas", subtítulo con el rango real de fechas; la hora/fecha fija de 2023 pasa a fecha y hora actuales (como en Analítica).
- Botones Bookmark / Start / Pause / Stop: se reemplazan por **filtros reales**: Todas · Activas · Sin gasto reciente (según la última actividad de cada campaña). No se encienden ni pausan campañas en Meta desde aquí.
- "Newest": orden real: Mayor gasto · Más clics · Mejor CTR · Actividad más reciente.
- Botón de engranaje: pasa a botón de recargar datos.
- Selector de cliente (el mismo del Dashboard, recordado entre páginas) y selector de período 7/30/90 días.
- Cada tarjeta: agregar leads y conversaciones (ya existen en la base) y el nombre del cliente/cuenta.

## Analítica (`analytics.html`)
- Respeta el cliente elegido en el Dashboard.
- "Objetivos y plataformas": se llena con el **objetivo de campaña** real (columna `objective` de los datos de Meta): gasto y clics por objetivo, y CTR global real. El desglose por plataforma (Facebook/Instagram) no existe en los datos sincronizados; esa parte se oculta en vez de mostrar "Sin datos".
- "Most Performed Ads": top 5 **anuncios reales** por gasto (nombre del anuncio, campaña, gasto, clics, impresiones). Se quitan los ejemplos "Floor Lamp".
- Tarjetas de abajo (67,124 / 412,531 / $4,567 / $5,245) y "Trending ads": se llenan con campañas del período, impresiones, gasto del último día y del anterior (con su fecha real), y anuncios con mayor alza.

## Detalles técnicos
- Shared: `localStorage['apache360.selectedClientId']` leído por compaign.js/analytics.js y enviado como `client_id` a `windsor-metrics`.
- `windsor-metrics`: agregar `objectiveBreakdown` (desde `meta_datos.objective`, RLS por JWT) y `topAds` a nivel anuncio (`ad_id`, `ad_name`), más `leads`/`messaging_conversations` por campaña. Nueva RPC SQL `meta_ad_totals(_days, _client_id)` y `meta_objective_totals(_days, _client_id)` como `security invoker` (RLS sigue mandando), versionadas en `supabase/migrations/`.
- Redesplegar `windsor-metrics` y verificar: con sesión 200 y datos; sin sesión 401.
- Sin cambios en `/app` (React).
