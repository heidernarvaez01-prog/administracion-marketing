# Miembros e Inteligencia para viewers

## 1. Miembros y roles
- Corregir la carga de miembros: ante una sesión vencida o un fallo, mostrar el error y permitir volver a cargar, sin presentar una lista vacía como si no existieran usuarios.
- Mostrar los roles reales: Administrador, Manager de agencia, Viewer de cliente o Sin acceso, junto con la agencia y los clientes asignados.
- Añadir «Cambiar acceso» a cada miembro para que el administrador asigne o retire acceso como manager de una agencia o viewer de un cliente.
- Conservar a Heider como único administrador; este control no permitirá convertir a otros usuarios en administradores ni cambiar contraseñas al modificar roles.

## 2. Inteligencia para viewers
- Mostrar el apartado Inteligencia y permitir entrar a Preguntar a la IA, Brief, Clusters y Reporte semanal.
- Brief: consultar, sin guardar ni editar.
- Clusters y Reporte semanal: consultar resultados disponibles y generar una vista previa sin guardarla, editarla ni enviar correos.
- Preguntar a la IA: permitir preguntas y seguimiento sobre sus propios clientes, con respuestas basadas en sus datos reales.
- Mantener ocultas las acciones de administración y edición; comprobar los permisos también en el servidor.

## 3. Respuestas con información real
- Utilizar el servicio de IA ya configurado; no hace falta otra API key para este paso.
- Obtener métricas del cliente permitido antes de responder, indicando período, moneda y limitaciones cuando falten datos.
- No mezclar importes de monedas distintas ni permitir consultar otros clientes modificando una dirección o una solicitud.

## Verificación
- Comprobar la lista y el formulario con la sesión de administrador, sin cambiar roles o contraseñas de usuarios reales durante las pruebas.
- Probar con cuentas temporales de dos clientes: consulta permitida, edición denegada y datos del otro cliente inaccesibles.
- Ejecutar una pregunta y su seguimiento con métricas reales, y comprobar las vistas previas sin enviar correos.
- Las pruebas de IA consumirán créditos del proyecto.

## Detalles técnicos
- Cambiar solo Eclan y las funciones necesarias para miembros e Inteligencia; no modificar React `/app`.
- Mantener roles y membresías protegidos, con autorización administrativa validada en servidor para cambios de acceso.
- Conservar las restricciones de escritura para viewers. Si hacen falta permisos de lectura, aplicar cambios limitados a clientes asignados y versionarlos en `supabase/migrations/`.
- Separar generación de vistas previas de guardado y envío en las funciones existentes; redesplegar únicamente las modificadas.
- Añadir y ejecutar pruebas de autorización, aislamiento y operaciones de solo consulta.