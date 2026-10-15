// Tarjeta "País y región" de Analítica: meta_breakdown_totals('region').
// RLS limita a cuentas visibles; gasto nunca se mezcla entre monedas.
(function ($) {
	"use strict";
	var PRESET_DAYS = { last_7d: 7, last_30d: 30, last_90d: 90 };
	var COUNTRIES = { Mexico: "México", "United States": "Estados Unidos", Colombia: "Colombia", Curacao: "Curazao", Aruba: "Aruba", Netherlands: "Países Bajos", Venezuela: "Venezuela", Spain: "España" };
	var days = 90, currency = null, rows = [], showAll = false, LIMIT = 10;
	function n(v) { return Number(v) || 0; }
	function fmtInt(v) { return n(v).toLocaleString("es-MX"); }
	function money(v) { return n(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (currency || ""); }
	function td(t, r) { return $("<td>", { class: r ? "text-end" : "" }).text(t); }

	function render() {
		var list = rows.filter(function (r) { return r.currency === currency; });
		var total = list.reduce(function (a, r) { return a + n(r.spend); }, 0);
		var $b = $("#geoBody").empty();
		(showAll ? list : list.slice(0, LIMIT)).forEach(function (r) {
			var share = total > 0 ? (n(r.spend) / total) * 100 : 0;
			var ctr = n(r.impressions) > 0 ? (n(r.clicks) / n(r.impressions)) * 100 : 0;
			$b.append($("<tr>").append(td(COUNTRIES[r.dim1] || r.dim1 || "Sin dato"), td(r.dim2 || "Sin dato"), td(money(r.spend), 1),
				$("<td>").append($("<div>", { class: "d-flex align-items-center" }).append(
					$("<div>", { class: "progress flex-grow-1 me-2", style: "height:6px" }).append($("<div>", { class: "progress-bar bg-primary", style: "width:" + share + "%" })),
					$("<span>", { class: "fs-13" }).text(share.toFixed(0) + "%"))),
				td(fmtInt(r.clicks), 1), td(ctr.toFixed(2) + "%", 1), td(fmtInt(r.leads), 1), td(fmtInt(r.messaging_conversations), 1)));
		});
		if (!list.length) $b.append($("<tr>").append($("<td>", { colspan: 8, class: "text-muted" }).text("Sin datos por región en este período.")));
		$("#geoMore").toggleClass("d-none", list.length <= LIMIT).text(showAll ? "Ver solo las 10 principales" : "Ver todas las regiones (" + list.length + ")");
		$("#geoSubtitle").text("Dónde está la gente que ve los anuncios · últimos " + days + " días");
	}

	function load() {
		if (typeof AuditClient === "undefined") return;
		var cid = null;
		try { cid = localStorage.getItem("apache360.selectedClientId") || null; } catch (e) {}
		AuditClient.requireAuth().then(function (s) {
			if (!s) return null;
			return AuditClient.supabase.rpc("meta_breakdown_totals", { _kind: "region", _days: days, _client_id: cid });
		}).then(function (res) {
			if (!res) return;
			if (res.error) throw res.error;
			rows = res.data || [];
			var spendBy = {};
			rows.forEach(function (r) { spendBy[r.currency] = (spendBy[r.currency] || 0) + n(r.spend); });
			var curs = Object.keys(spendBy).sort(function (a, b) { return spendBy[b] - spendBy[a]; });
			if (!currency || curs.indexOf(currency) < 0) currency = curs[0] || null;
			var $sel = $("#geoCurrency").empty().toggleClass("d-none", curs.length < 2);
			curs.forEach(function (c) { $sel.append($("<option>", { value: c, text: c, selected: c === currency })); });
			render();
		}).catch(function (err) {
			console.error("meta_breakdown_totals region:", err);
			$("#geoBody").empty().append($("<tr>").append($("<td>", { colspan: 8, class: "text-danger" }).text("No se pudieron cargar los datos por región.")));
		});
	}

	jQuery(window).on("load", function () {
		$(document).on("change", "#geoCurrency", function () { currency = $(this).val(); render(); });
		$(document).on("click", "#geoMore", function () { showAll = !showAll; render(); });
		$(document).on("click", ".range-tabs .nav-link", function () {
			var d = PRESET_DAYS[$(this).data("preset")];
			if (d && d !== days) { days = d; load(); }
		});
		setTimeout(load, 300);
	});
})(jQuery);
