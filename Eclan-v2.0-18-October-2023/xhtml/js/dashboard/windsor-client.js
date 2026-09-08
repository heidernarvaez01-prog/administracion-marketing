/**
 * Cliente compartido para llamar a la Edge Function "windsor-metrics" de
 * Supabase desde las páginas estáticas de Eclan (analytics.html,
 * compaign.html). No hay build step acá (no es la app Vite/React), así
 * que la URL y la anon key públicas van literales — son las mismas que
 * ya están en el .env de la app (VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY). La anon key de Supabase está pensada
 * para ser pública en el cliente; la clave real de Windsor.ai NUNCA pasa
 * por acá, vive solo como secret de la Edge Function.
 */
(function (window) {
	"use strict";

	var SUPABASE_URL = "https://prkmsvbzxhztplvdtwaq.supabase.co";
	var SUPABASE_ANON_KEY =
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBya21zdmJ6eGh6dHBsdmR0d2FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODAxNDIsImV4cCI6MjA4NTI1NjE0Mn0.cdaOVYsI8vO1Jst-9Ie3ZXLselLOr4zLisIA4RTLPvo";

	function fetchMetrics(options) {
		options = options || {};
		var url = SUPABASE_URL + "/functions/v1/windsor-metrics";
		if (options.datePreset) {
			url += "?date_preset=" + encodeURIComponent(options.datePreset);
		}

		return fetch(url, {
			headers: {
				apikey: SUPABASE_ANON_KEY,
				Authorization: "Bearer " + SUPABASE_ANON_KEY,
			},
		})
			.then(function (res) {
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

	// Formatters chiquitos reutilizados por analytics.js / compaign.js
	function money(n) {
		return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function compact(n) {
		return Number(n || 0).toLocaleString("en-US");
	}

	window.WindsorClient = {
		fetchMetrics: fetchMetrics,
		money: money,
		compact: compact,
	};
})(window);
