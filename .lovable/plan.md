# Recuperar la sesión del Dashboard

## Hallazgo
La consulta de `windsor-metrics` responde 200 con la sesión actual. El error informado no se reprodujo en esa sesión; el cliente compartido no recupera una petición rechazada con 401.

## Cambio propuesto
- Ante un 401, renovar la sesión y repetir la consulta una sola vez.
- Compartir la renovación entre consultas simultáneas para evitar renovaciones duplicadas.
- Si no hay sesión recuperable, mostrar el error de sesión sin ocultar los controles del Dashboard.
- Mantener la protección actual: ninguna consulta sin sesión válida podrá leer datos.

## Detalles técnicos
Cambiar únicamente el cliente compartido de consultas de Eclan, añadir pruebas de recuperación y documentar la regla en `AGENTS.md`. No cambiar permisos, tablas ni la interfaz de React.

## Verificación
Probar recuperación ante un 401 simulado, límite de un reintento y rechazo de consultas sin sesión. Comprobar después el Dashboard de Ginecea con sesión real y una consulta anónima que debe seguir devolviendo 401.