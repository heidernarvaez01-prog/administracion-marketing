/**
 * Cliente compartido para llamar a la Edge Function "windsor-metrics" de
 * Supabase desde las páginas estáticas de Eclan (analytics.html,
 * compaign.html). No hay build step acá (no es la app Vite/React), así
 * que la URL y la anon key públicas van literales — son las mismas que
 * ya están en el .env de la app (VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY). La anon key de Supabase está pensada
 * para ser pública en el cliente; la clave real de Windsor.ai NUNCA pasa
 * por acá, vive solo como secret de la Edge Function.
 *
 * windsor-metrics ahora exige sesión real (ver Paso 0 de CLAUDE.md): el
 * JWT de la sesión de AuditClient va en el header Authorization, no la
 * anon key fija — sin eso, la función responde 401. Requiere que la
 * página haya cargado antes supabase-client.js.
 */
(function (window) {
	"use strict";

	var SUPABASE_URL = "https://szdivobcbdkiszgrizic.supabase.co";
	var SUPABASE_ANON_KEY = "sb_publishable_ldumgPigulWT8adpCHpa_Q_dLVy4EC-";
	var refreshPromise = null;

	function sessionError() {
		var err = new Error("Sesión requerida. Vuelve a iniciar sesión.");
		err.status = 401;
		return err;
	}

	// Una renovación compartida evita rotar el mismo refresh token en paralelo.
	function refreshAccessToken() {
		if (!refreshPromise) {
			refreshPromise = Promise.resolve().then(function () {
				var auth = window.AuditClient && window.AuditClient.supabase && window.AuditClient.supabase.auth;
				if (!auth) throw sessionError();
				return auth.refreshSession();
			}).then(function (result) {
				var session = result.data && result.data.session;
				if (result.error || !session || !session.access_token) throw sessionError();
				return session.access_token;
			}).then(function (token) {
				refreshPromise = null;
				return token;
			}, function () {
				refreshPromise = null;
				throw sessionError();
			});
		}
		return refreshPromise;
	}

	function fetchMetrics(options) {
		options = options || {};
		var url = SUPABASE_URL + "/functions/v1/windsor-metrics";
		var params = [];
		if (options.datePreset) params.push("date_preset=" + encodeURIComponent(options.datePreset));
		if (options.clientId) params.push("client_id=" + encodeURIComponent(options.clientId));
		if (options.currency) params.push("currency=" + encodeURIComponent(options.currency));
		if (options.raw) params.push("raw=1");
		if (params.length) url += "?" + params.join("&");

		var getToken = window.AuditClient
			? window.AuditClient.getSession().then(function (session) { return session && session.access_token; })
			: Promise.resolve(null);

		function request(accessToken) {
			return fetch(url, {
				headers: {
					apikey: SUPABASE_ANON_KEY,
					Authorization: "Bearer " + accessToken,
				},
			});
		}

		return getToken.then(function (accessToken) {
			if (!accessToken) throw sessionError();
			return request(accessToken);
		}).then(function (res) {
			if (res.status !== 401) return res;
			return refreshAccessToken().then(request);
		}).then(function (res) {
			return res.json().then(function (body) {
				if (!res.ok || body.error) {
					var err = new Error(
						(body && body.mensaje) || "windsor-metrics respondió " + res.status
					);
					err.status = (body && body.status) || res.status;
					err.payload = body;
					throw err;
				}
				return body;
			});
		});
	}

	// Formatters chiquitos reutilizados por analytics.js / compaign.js.
	// currency es obligatorio en la práctica (compaign.js/analytics.js
	// siempre lo mandan, tomado de data.currency) — sin él no hay forma de
	// saber si el número es MXN o USD, y mostrar solo "$" ya causó que
	// Ginecea (MXN) se leyera como si fuera dólares.
	function money(n, currency) {
		var formatted = Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return currency ? currency + " " + formatted : "$" + formatted;
	}

	function compact(n) {
		return Number(n || 0).toLocaleString("es-ES");
	}

	// "2026-08-19" -> "19 ago"
	function shortDate(iso) {
		if (!iso) return "";
		var d = new Date(iso + "T00:00:00");
		if (isNaN(d.getTime())) return iso;
		return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "");
	}

	// "2026-08-19" -> "19 de agosto de 2026"
	function longDate(iso) {
		if (!iso) return "";
		var d = new Date(iso + "T00:00:00");
		if (isNaN(d.getTime())) return iso;
		return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
	}

	window.WindsorClient = {
		fetchMetrics: fetchMetrics,
		money: money,
		compact: compact,
		shortDate: shortDate,
		longDate: longDate,
	};
})(window);
