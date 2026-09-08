/**
 * Cliente de Supabase compartido para las páginas Eclan que necesitan
 * login real y acceso directo a tablas (a diferencia de windsor-client.js,
 * que solo llama a la Edge Function windsor-metrics). Requiere que la
 * página cargue antes el UMD de @supabase/supabase-js por CDN:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js"></script>
 *   <script src="js/dashboard/supabase-client.js"></script>
 *
 * Misma URL/anon key que windsor-client.js (públicas por diseño, ver el
 * comentario en ese archivo). El cliente vive en window.AuditClient.
 */
(function (window) {
	"use strict";

	if (!window.supabase || !window.supabase.createClient) {
		console.error("supabase-client.js: falta cargar el UMD de @supabase/supabase-js antes de este script.");
		return;
	}

	var SUPABASE_URL = "https://szdivobcbdkiszgrizic.supabase.co";
	var SUPABASE_ANON_KEY = "sb_publishable_ldumgPigulWT8adpCHpa_Q_dLVy4EC-";

	var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: { persistSession: true, autoRefreshToken: true },
	});

	function getSession() {
		return client.auth.getSession().then(function (res) {
			return (res.data && res.data.session) || null;
		});
	}

	/** Redirige a page-login.html si no hay sesión. Devuelve la sesión (o
	 *  null, si redirigió) para que el caller pueda seguir encadenando. */
	function requireAuth() {
		return getSession().then(function (session) {
			if (!session) {
				window.location.replace("page-login.html");
				return null;
			}
			return session;
		});
	}

	/** Para page-login.html/page-register.html: si ya hay sesión, no tiene
	 *  sentido mostrar el formulario — manda directo a clientes.html. */
	function redirectIfAuthenticated(destination) {
		return getSession().then(function (session) {
			if (session) window.location.replace(destination || "clientes.html");
			return session;
		});
	}

	function signOut() {
		return client.auth.signOut().then(function () {
			window.location.replace("page-login.html");
		});
	}

	/** Traduce los mensajes de error más comunes de Supabase Auth a español. */
	function authErrorMessage(error) {
		var msg = (error && error.message) || "";
		if (/Invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
		if (/User already registered/i.test(msg)) return "Ya existe una cuenta con ese correo.";
		if (/Password should be at least/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
		if (/password is known to be weak|been found in.*data breach|pwned/i.test(msg)) return "Esa contraseña apareció en alguna filtración de datos conocida — elige otra.";
		if (/Unable to validate email address/i.test(msg)) return "Ese correo no es válido.";
		return msg || "Ocurrió un error inesperado.";
	}

	window.AuditClient = {
		supabase: client,
		getSession: getSession,
		requireAuth: requireAuth,
		redirectIfAuthenticated: redirectIfAuthenticated,
		signOut: signOut,
		authErrorMessage: authErrorMessage,
	};
})(window);
