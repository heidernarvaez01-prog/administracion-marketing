/**
 * Identidad real en la cabecera (Paso 2) y menú por rol (Paso 3). Cosmético
 * en los dos casos: la seguridad real sigue siendo RLS, nunca esto — ocultar
 * un link de menú no protege ningún dato, solo evita confundir a quien no
 * lo necesita. Requiere supabase-client.js cargado antes. Si no hay sesión,
 * no hace nada: la propia página (su script de dashboard) ya redirige a
 * page-login.html por su cuenta.
 *
 * Los íconos/botón/buscador/chat de relleno (campana, mensajes, regalo,
 * "+ New Campaign", "Search Here", el panel de chat) y las páginas de
 * plantilla sin relación con marketing (data-demo-menu) NO dependen de este
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

		if (identity.role === "admin") {
			// audit-extras.css oculta [data-require-role] por default (evita
			// el parpadeo de mostrarlo un instante a cualquiera); se revela
			// quitando el atributo, no agregando una clase.
			$("[data-require-role]").removeAttr("data-require-role");
		}
	}).catch(function (err) {
		console.error("role-ui:", err);
	});
})(jQuery);
