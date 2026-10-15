# Unir Dashboard y Analítica, ordenar el menú y revisar desbordes

## 1. Un solo Dashboard
- El Dashboard (`index.html`) pasa a tener todo lo de Analítica, sin repetir tarjetas:
  - Arriba: selector de cliente + 7/30/90 días (ya existe) y selector de moneda si hay varias.
  - KPIs (gasto, clics, impresiones, CTR, leads, conversaciones) — una sola fila.
  - Gráficos diarios de clics y gasto.
  - Campañas con más gasto + Anuncios con más gasto (con miniatura, cuando esté el paso 5).
  - Objetivos de campaña y CTR.
  - Facebook vs Instagram, Edad y género, País y región.
- `analytics.html` deja de estar en el menú y redirige al Dashboard (los enlaces viejos siguen funcionando).

## 2. Menú ordenado (con nombres visibles, no solo íconos)
```text
Resultados
  Dashboard
  Campañas
  Calendario            (admin)
Clientes
  Clientes
  Alertas               (admin)
  Auditoría             (admin)
Inteligencia            (admin)
  Preguntar a la IA
  Reporte semanal
  Clusters
  Brief de marca
Administración          (admin)
```
- Viewer/manager siguen viendo solo Dashboard, Campañas y Clientes.
- Se aplica igual en las 13 páginas.

## 3. Textos y números dentro de sus marcos
- Recorrer cada página como admin en pantalla de escritorio y de celular, detectar automáticamente elementos cuyo texto se sale de su tarjeta y corregir:
  números grandes con tamaño adaptable, nombres largos de campaña/anuncio con corte "…" y el nombre completo al pasar el mouse, tablas con desplazamiento horizontal.
- Capturas antes/después de las páginas corregidas.

## Detalles técnicos
- Scripts de las tarjetas (`analytics-platforms/demographics/geo.js`) se cargan también en `index.html` y se enganchan al selector de período del Dashboard.
- La lógica de `analytics.js` que no esté ya en `dashboard-home.js` se mueve allí; sin cambios en la base.
- El menú se genera desde un único archivo compartido para que las 13 páginas no se desalineen.
