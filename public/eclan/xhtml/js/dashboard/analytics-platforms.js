// Tarjeta "Facebook vs Instagram" de Analítica: lee meta_breakdown_totals
// ('platform' y 'placement'). RLS limita a las cuentas visibles; el gasto
// nunca se mezcla entre monedas (selector si hay más de una).
(function ($) {
	"use strict";
	var PLATFORM_NAMES = { facebook: "Facebook", instagram: "Instagram", audience_network: "Audience Network", messenger: "Messenger", threads: "Threads" };
	var PLACEMENT_NAMES = {
		feed: "Feed", facebook_reels: "Reels", instagram_reels: "Reels", facebook_stories: "Stories", instagram_stories: "Stories",
		instream_video: "Video in-stream", search: "Búsqueda", facebook_notification: "Notificaciones", marketplace: "Marketplace",
		video_feeds: "Feed de videos", right_hand_column: "Columna derecha", instagram_explore: "Explorar", instagram_explore_grid_home: "Explorar (inicio)",
		instagram_profile_feed: "Feed del perfil", an_classic: "Clásico", rewarded_video: "Video con recompensa", messenger_inbox: "Bandeja", messenger_stories: "Stories",
		facebook_profile_feed: "Feed del perfil", facebook_reels_overlay: "Reels (superpuesto)", instagram_search: "Búsqueda",
	};
	var PRESET_DAYS = { last_7d: 7, last_30d: 30, last_90d: 90 };
	var days = 90, currency = null, rows = { platform: [], placement: [] };

	function n(v) { return Number(v) || 0; }
	function fmtInt(v) { return n(v).toLocaleString("es-MX"); }
	function money(v) { return n(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (currency || ""); }
	function pname(id) { return PLATFORM_NAMES[id] || id || "Sin dato"; }
	function plname(id) { return PLACEMENT_NAMES[id] || (id || "Sin dato").replace(/_/g, " "); }
	function td(text, right) { return $("<td>", { class: right ? "text-end" : "" }).text(text); }

	function render() {
		var plat = rows.platform.filter(function (r) { return r.currency === currency; });
		var place = rows.placement.filter(function (r) { return r.currency === currency; });
		var total = plat.reduce(function (a, r) { return a + n(r.spend); }, 0);
		var $sum = $("#platformsSummary").empty();
		if (!plat.length) {
			$sum.append($("<div>", { class: "col-12 text-muted fs-14" }).text("Sin datos por plataforma en este período."));
		}
		plat.forEach(function (r) {
			var share = total > 0 ? Math.round((n(r.spend) / total) * 100) : 0;
			var ctr = n(r.impressions) > 0 ? (n(r.clicks) / n(r.impressions)) * 100 : 0;
			var $c = $("<div>", { class: "col-md-3 col-sm-6 mb-3" }).append(
				$("<div>", { class: "border rounded p-3 h-100" }).append(
					$("<div>", { class: "fs-16 font-w600 text-black" }).text(pname(r.dim1)),
					$("<div>", { class: "fs-20 font-w700 text-primary" }).text(money(r.spend)),
					$("<div>", { class: "fs-13 text-muted mb-2" }).text(share + "% del gasto"),
					$("<div>", { class: "progress mb-2", style: "height:6px" }).append($("<div>", { class: "progress-bar bg-primary", style: "width:" + share + "%" })),
					$("<div>", { class: "fs-13" }).text(fmtInt(r.clicks) + " clics · CTR " + ctr.toFixed(2) + "%"),
					$("<div>", { class: "fs-13" }).text(fmtInt(r.leads) + " leads · " + fmtInt(r.messaging_conversations) + " conversaciones")
				)
			);
			$sum.append($c);
		});
		var $b = $("#placementsBody").empty();
		if (!place.length) $b.append($("<tr>").append($("<td>", { colspan: 9, class: "text-muted" }).text("Sin datos.")));
		place.forEach(function (r) {
			var ctr = n(r.impressions) > 0 ? (n(r.clicks) / n(r.impressions)) * 100 : 0;
			var cpc = n(r.clicks) > 0 ? n(r.spend) / n(r.clicks) : 0;
			$b.append($("<tr>").append(
				td(pname(r.dim1)), td(plname(r.dim2)), td(money(r.spend), 1), td(fmtInt(r.impressions), 1),
				td(fmtInt(r.clicks), 1), td(ctr.toFixed(2) + "%", 1), td(n(r.clicks) ? money(cpc) : "—", 1),
				td(fmtInt(r.leads), 1), td(fmtInt(r.messaging_conversations), 1)
			));
		});
		$("#platformsSubtitle").text("Rendimiento por plataforma y ubicación · últimos " + days + " días");
	}

	function load() {
		if (typeof AuditClient === "undefined") return;
		var cid = null;
		try { cid = localStorage.getItem("apache360.selectedClientId") || null; } catch (e) {}
		var sb = AuditClient.supabase;
		AuditClient.requireAuth().then(function (session) {
			if (!session) return null;
			return Promise.all([
				sb.rpc("meta_breakdown_totals", { _kind: "platform", _days: days, _client_id: cid }),
				sb.rpc("meta_breakdown_totals", { _kind: "placement", _days: days, _client_id: cid }),
			]);
		}).then(function (res) {
			if (!res) return;
			if (res[0].error || res[1].error) throw res[0].error || res[1].error;
			rows.platform = res[0].data || [];
			rows.placement = res[1].data || [];
			var spendBy = {};
			rows.platform.forEach(function (r) { var c = r.currency || "—"; spendBy[c] = (spendBy[c] || 0) + n(r.spend); });
			var curs = Object.keys(spendBy).sort(function (a, b) { return spendBy[b] - spendBy[a]; });
			if (!currency || curs.indexOf(currency) < 0) currency = curs[0] || null;
			var $sel = $("#platformsCurrency").empty().toggleClass("d-none", curs.length < 2);
			curs.forEach(function (c) { $sel.append($("<option>", { value: c, text: c, selected: c === currency })); });
			render();
		}).catch(function (err) {
			console.error("meta_breakdown_totals:", err);
			$("#placementsBody").empty().append($("<tr>").append($("<td>", { colspan: 9, class: "text-danger" }).text("No se pudieron cargar los datos por plataforma.")));
		});
	}

	jQuery(window).on("load", function () {
		$(document).on("change", "#platformsCurrency", function () { currency = $(this).val(); render(); });
		$(document).on("click", ".range-tabs .nav-link", function () {
			var d = PRESET_DAYS[$(this).data("preset")];
			if (d && d !== days) { days = d; load(); }
		});
		setTimeout(load, 300);
	});
})(jQuery);
