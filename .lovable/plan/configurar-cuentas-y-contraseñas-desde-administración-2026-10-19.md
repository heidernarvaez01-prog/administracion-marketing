# Configurar cuentas y contraseñas desde Administración

## Lo que tendrás
- En **Equipo**, crear una cuenta con correo, contraseña y confirmación, sin enviar invitaciones.
- En cada miembro, la opción **Establecer contraseña** para cuentas existentes, incluida operations@apachestudio.mx. Pedirá escribirla dos veces y confirmar el cambio.
- En **Clientes y Agencias**, vincular la cuenta creada a Ginecea como viewer, conservando los permisos actuales. La lista de cuentas se actualizará al crear una nueva.
- Mantener la invitación y recuperación por correo como alternativas, mostrando si el envío realmente falló en vez de anunciar éxito.

## Seguridad
- Solo el administrador autorizado podrá crear cuentas o cambiar contraseñas ajenas; comprobarlo en el servidor, no solo ocultar botones.
- No otorgar permisos de administrador al crear estas cuentas ni modificar los accesos existentes.
- Las cuentas creadas manualmente quedarán listas para entrar con correo y contraseña. No se habilitará el registro público ni se cambiará la confirmación general de correo.
- No mostrar ni guardar contraseñas en listas, registros o almacenamiento del navegador; limpiar los campos tras guardar o cerrar.
- No cambiar la contraseña de operations@apachestudio.mx durante las pruebas: la elegirás tú en el formulario.

## Invitaciones actuales
El código actual anuncia éxito incluso cuando el servicio de correo devuelve que no envió la invitación. Los registros disponibles no identifican una causa de entrega específica; corregir ese aviso y revisar la respuesta real, sin enviar correos adicionales durante las pruebas.

## Detalles técnicos
- Ampliar la función existente `admin-users` con creación manual y actualización administrativa de contraseñas, conservando la comprobación de sesión y `user_roles`.
- Actualizar exclusivamente la administración Eclan y sus scripts; no modificar React ni crear tablas o perfiles adicionales.
- Redesplegar `admin-users` para activar los cambios.
- Añadir pruebas de validación y autorización, y comprobar el formulario con sesión de administrador. Verificar el ingreso y aislamiento con cuentas de prueba sin modificar credenciales de usuarios reales.