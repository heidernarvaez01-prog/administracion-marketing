/**
 * Identidad real en la cabecera (Paso 2): reemplaza "Samuel Anderson /
 * Super Admin" por el correo y el rol real de quien está logueado.
 * Cosmético — la seguridad real sigue siendo RLS. Requiere
 * supabase-client.js cargado antes. Si no hay sesión, no hace nada: la
 * propia página (su script de dashboard) ya redirige a page-login.html
 * por su cuenta.
 *
 * Los íconos/botón/buscador/chat de relleno (campana, mensajes, regalo,
 * "+ New Campaign", "Search Here", el panel de chat) NO dependen de este
 * archivo — se ocultan siempre por CSS en audit-extras.css, para todos,
 * sin importar el rol.
 */
(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined" || typeof AuditClient.getCurrentIdentity !== "function") return;

	AuditClient.getCurrentIdentity().then(function (identity) {
		if (!identity) return;

		var $name = $("#headerUserName");
		var $role = $("#headerUserRole");
		if ($name.length) $name.text(identity.email || "");
		if ($role.length) $role.text(identity.label || "");
	}).catch(function (err) {
		console.error("role-ui:", err);
	});
})(jQuery);
