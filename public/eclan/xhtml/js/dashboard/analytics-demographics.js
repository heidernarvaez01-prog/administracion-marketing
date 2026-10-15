// Tarjeta "Edad y género" de Analítica: meta_breakdown_totals('age_gender').
// RLS limita a cuentas visibles; gasto nunca se mezcla entre monedas.
(function ($) {
	"use strict";
	var GENDER = { female: "Mujeres", male: "Hombres", unknown: "Sin especificar" };
	var PRESET_DAYS = { last_7d: 7, last_30d: 30, last_90d: 90 };
	var days = 90, currency = null, rows = [];

	function n(v) { return Number(v) || 0; }
	function fmtInt(v) { return n(v).toLocaleString("es-MX"); }
	function money(v) { return n(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (currency || ""); }
	function td(t, r) { return $("<td>", { class: r ? "text-end" : "" }).text(t); }
	function add(a, r) { ["spend", "impressions", "clicks", "leads", "messaging_conversations"].forEach(function (k) { a[k] = n(a[k]) + n(r[k]); }); return a; }

	function render() {
		var list = rows.filter(function (r) { return r.currency === currency; });
		var byGender = {}, byAge = {}, total = 0;
		list.forEach(function (r) {
			total += n(r.spend);
			byGender[r.dim2] = add(byGender[r.dim2] || {}, r);
			var a = byAge[r.dim1] = add(byAge[r.dim1] || { g: {} }, r);
			a.g[r.dim2] = n(a.g[r.dim2]) + n(r.spend);
		});
		var $g = $("#demoGenders").empty();
		["female", "male", "unknown"].forEach(function (k) {
			var r = byGender[k]; if (!r) return;
			var share = total > 0 ? Math.round((r.spend / total) * 100) : 0;
			$g.append($("<div>", { class: "col-md-4 mb-3" }).append($("<div>", { class: "border rounded p-3 h-100" }).append(
				$("<div>", { class: "fs-16 font-w600 text-black" }).text(GENDER[k]),
				$("<div>", { class: "fs-20 font-w700 text-primary" }).text(money(r.spend)),
				$("<div>", { class: "fs-13 text-muted" }).text(share + "% del gasto · " + fmtInt(r.clicks) + " clics"),
				$("<div>", { class: "fs-13" }).text(fmtInt(r.leads) + " leads · " + fmtInt(r.messaging_conversations) + " conversaciones")
			)));
		});
		if (!list.length) $g.append($("<div>", { class: "col-12 text-muted fs-14" }).text("Sin datos de edad y género en este período."));
		var $b = $("#demoBody").empty();
		Object.keys(byAge).sort().forEach(function (age) {
			var r = byAge[age];
			var f = r.spend > 0 ? (n(r.g.female) / r.spend) * 100 : 0, m = r.spend > 0 ? (n(r.g.male) / r.spend) * 100 : 0;
			var bar = $("<div>", { class: "progress", style: "height:8px", title: Math.round(f) + "% mujeres · " + Math.round(m) + "% hombres" }).append(
				$("<div>", { class: "progress-bar bg-secondary", style: "width:" + f + "%" }),
				$("<div>", { class: "progress-bar bg-info", style: "width:" + m + "%" }));
			var ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
			$b.append($("<tr>").append(td(age || "Sin dato"), td(money(r.spend), 1), $("<td>").append(bar),
				td(fmtInt(r.clicks), 1), td(ctr.toFixed(2) + "%", 1), td(fmtInt(r.leads), 1),
				td(fmtInt(r.messaging_conversations), 1), td(r.messaging_conversations ? money(r.spend / r.messaging_conversations) : "—", 1)));
		});
		if (!list.length) $b.append($("<tr>").append($("<td>", { colspan: 8, class: "text-muted" }).text("Sin datos.")));
		$("#demoSubtitle").text("Quién responde a los anuncios · últimos " + days + " días · barra: rosa mujeres, azul hombres");
	}

	function load() {
		if (typeof AuditClient === "undefined") return;
		var cid = null;
		try { cid = localStorage.getItem("apache360.selectedClientId") || null; } catch (e) {}
		AuditClient.requireAuth().then(function (s) {
			if (!s) return null;
			return AuditClient.supabase.rpc("meta_breakdown_totals", { _kind: "age_gender", _days: days, _client_id: cid });
		}).then(function (res) {
			if (!res) return;
			if (res.error) throw res.error;
			rows = res.data || [];
			var spendBy = {};
			rows.forEach(function (r) { spendBy[r.currency] = (spendBy[r.currency] || 0) + n(r.spend); });
			var curs = Object.keys(spendBy).sort(function (a, b) { return spendBy[b] - spendBy[a]; });
			if (!currency || curs.indexOf(currency) < 0) currency = curs[0] || null;
			var $sel = $("#demoCurrency").empty().toggleClass("d-none", curs.length < 2);
			curs.forEach(function (c) { $sel.append($("<option>", { value: c, text: c, selected: c === currency })); });
			render();
		}).catch(function (err) {
			console.error("meta_breakdown_totals age_gender:", err);
			$("#demoBody").empty().append($("<tr>").append($("<td>", { colspan: 8, class: "text-danger" }).text("No se pudieron cargar los datos de edad y género.")));
		});
	}

	jQuery(window).on("load", function () {
		$(document).on("change", "#demoCurrency", function () { currency = $(this).val(); render(); });
		$(document).on("click", ".range-tabs .nav-link", function () {
			var d = PRESET_DAYS[$(this).data("preset")];
			if (d && d !== days) { days = d; load(); }
		});
		setTimeout(load, 300);
	});
})(jQuery);
