# Más espacio para el Dashboard

## Cambios
- Abrir la aplicación con el menú lateral oculto. El botón de menú permitirá mostrarlo y volver a ocultarlo.
- Quitar la columna permanente de «Perfil» a la derecha y aprovechar ese ancho para los resultados.
- Mantener el correo, el rol y el cliente en un perfil compacto en la esquina superior derecha, con acceso a cerrar sesión.
- Quitar la foto de relleno «100×100» y evitar que los correos largos desborden.
- Mantener todas las opciones y los permisos actuales; solo cambia su presentación.

## Comprobación
- Revisar con una sesión real que el Dashboard ocupe el espacio liberado y que el menú se abra y cierre.
- Comprobar el perfil y el cierre de sesión, sin cambiar contraseñas ni datos de clientes.
- Revisar que tarjetas, cifras y textos no se superpongan.

## Detalles técnicos
- Cambios exclusivamente en el HTML, CSS y JavaScript compartidos de Eclan; no modificar React, funciones ni base de datos.
- Ajustar la inicialización de navegación y eliminar la reserva de ancho de `right-profile` en el Dashboard.