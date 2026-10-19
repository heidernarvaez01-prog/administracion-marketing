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
 *
 * `<body data-page-access="admin">` marca una página completa como solo
 * admin (Administración, Alertas, Brief, Clusters, Reporte semanal,
 * Preguntar a la IA, Calendario, Auditoría de monitoreo, Seleccionar
 * cliente): si quien entra no es admin, se le redirige a index.html. Es
 * cosmético igual que lo demás — quien llegue igual por otra vía no ve
 * datos ajenos porque RLS ya se lo impide en la base.
 */
(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined" || typeof AuditClient.getCurrentIdentity !== "function") return;

	AuditClient.getCurrentIdentity().then(function (identity) {
		if (!identity) return;

		var $name = $("#headerUserName");
		var $role = $("#headerUserRole");
		if ($name.length) $name.text(identity.email || "").attr("title", identity.email || "");
		if ($role.length) $role.text(identity.label || "").attr("title", identity.label || "");
		var $profileMenu = $(".header-profile .dropdown-menu");
		if ($profileMenu.length) {
			var $identity = $("<div>", { class: "apache-profile-summary" });
			$identity.append($("<strong>").text(identity.email || ""));
			$identity.append($("<small>").text(identity.label || ""));
			$profileMenu.prepend($identity);
		}

		var requiredRole = document.body.getAttribute("data-page-access");
		if (requiredRole && identity.role !== requiredRole) {
			window.location.replace("index.html");
			return;
		}

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
