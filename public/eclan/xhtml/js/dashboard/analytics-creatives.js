// Tarjeta "Creativos y video": top anuncios por gasto (meta_ad_totals) + meta_ad_creatives
// + embudo de video (video_p25..p100 de meta_datos). Todo bajo RLS; gasto en su moneda.
(function ($) {
	"use strict";
	var PRESET_DAYS = { last_7d: 7, last_30d: 30, last_90d: 90 }, days = 90, LIMIT = 8;
	function n(v) { return Number(v) || 0; }
	function fmtInt(v) { return n(v).toLocaleString("es-MX"); }
	function money(v, c) { return n(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (c || ""); }
	function since(d) { var t = new Date(); t.setDate(t.getDate() - d); return t.toISOString().slice(0, 10); }

	function funnel(v) {
		var $w = $("<div>", { class: "mt-2" });
		if (!v || !(v.p25 > 0)) return $w.append($("<p>", { class: "fs-13 text-muted mb-0" }).text("Sin reproducciones de video (anuncio de imagen)."));
		$w.append($("<p>", { class: "fs-13 mb-1 text-black" }).text("Video visto hasta:"));
		[["25%", v.p25], ["50%", v.p50], ["75%", v.p75], ["100%", v.p100]].forEach(function (s) {
			var pct = v.imp > 0 ? (s[1] / v.imp) * 100 : 0;
			$w.append($("<div>", { class: "d-flex align-items-center fs-13 mb-1" }).append(
				$("<span>", { style: "width:42px" }).text(s[0]),
				$("<div>", { class: "progress flex-grow-1 mx-2", style: "height:6px" }).append($("<div>", { class: "progress-bar bg-primary", style: "width:" + Math.min(100, pct) + "%" })),
				$("<span>", { class: "text-end", style: "min-width:90px" }).text(fmtInt(s[1]) + " (" + pct.toFixed(1) + "%)")));
		});
		return $w;
	}

	function render(ads, cr, vid) {
		var $g = $("#crGrid").empty();
		if (!ads.length) return $g.append($("<div>", { class: "col-12 text-muted" }).text("Sin anuncios con gasto en este período."));
		ads.forEach(function (a) {
			var c = cr[a.ad_id] || {}, img = c.image_url || c.thumbnail_url;
			var ctr = n(a.impressions) > 0 ? (n(a.clicks) / n(a.impressions)) * 100 : 0;
			var $media = img ? $("<img>", { src: img, alt: "", loading: "lazy", referrerpolicy: "no-referrer", style: "width:100%;height:180px;object-fit:cover;border-radius:8px" })
				.on("error", function () { $(this).replaceWith($("<div>", { class: "bg-light text-muted fs-13 d-flex align-items-center justify-content-center", style: "height:180px;border-radius:8px" }).text("Imagen no disponible")); })
				: $("<div>", { class: "bg-light text-muted fs-13 d-flex align-items-center justify-content-center", style: "height:180px;border-radius:8px" }).text("Sin imagen");
			$g.append($("<div>", { class: "col-xl-3 col-lg-4 col-sm-6 mb-4" }).append($("<div>", { class: "border rounded p-3 h-100 min-w-0" }).append(
				$media,
				$("<h5>", { class: "fs-15 text-black mt-3 mb-1 text-truncate", title: a.ad_name }).text(a.ad_name || "Anuncio " + a.ad_id),
				$("<p>", { class: "fs-13 text-muted mb-1 text-truncate", title: a.campaign_name }).text(a.campaign_name || ""),
				c.title ? $("<p>", { class: "fs-14 fw-semibold mb-1" }).text(c.title) : null,
				c.body ? $("<p>", { class: "fs-13 mb-2", title: c.body, style: "display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden" }).text(c.body) : null,
				$("<div>", { class: "d-flex flex-wrap fs-13 gap-2" }).append(
					$("<span>").text("Gasto: " + money(a.spend, a.currency)), $("<span>").text("Clics: " + fmtInt(a.clicks)),
					$("<span>").text("CTR: " + ctr.toFixed(2) + "%"), $("<span>").text("Conv.: " + fmtInt(n(a.leads) + n(a.messaging_conversations)))),
				funnel(vid[a.ad_id]),
				c.link_url ? $("<a>", { href: c.link_url, target: "_blank", rel: "noopener", class: "fs-13 d-inline-block mt-2" }).text("Ver destino") : null)));
		});
	}

	function load() {
		if (typeof AuditClient === "undefined") return;
		var cid = null, sb = AuditClient.supabase, ads;
		try { cid = localStorage.getItem("apache360.selectedClientId") || null; } catch (e) {}
		$("#crSubtitle").text("Los " + LIMIT + " anuncios con más gasto · últimos " + days + " días · imagen, texto y cuánto se ven sus videos");
		AuditClient.requireAuth().then(function (s) {
			if (!s) return null;
			return sb.rpc("meta_ad_totals", { _days: days, _client_id: cid });
		}).then(function (res) {
			if (!res) return null;
			if (res.error) throw res.error;
			ads = (res.data || []).filter(function (a) { return n(a.spend) > 0; }).sort(function (a, b) { return n(b.spend) - n(a.spend); }).slice(0, LIMIT);
			var ids = ads.map(function (a) { return a.ad_id; });
			if (!ids.length) return [{ data: [] }, { data: [] }];
			return Promise.all([
				sb.from("meta_ad_creatives").select("ad_id,thumbnail_url,image_url,title,body,link_url").in("ad_id", ids),
				sb.from("meta_datos").select("ad_id,impressions,video_p25,video_p50,video_p75,video_p100").in("ad_id", ids).gte("fecha", since(days)).limit(5000)
			]);
		}).then(function (r) {
			if (!r) return;
			if (r[0].error) throw r[0].error; if (r[1].error) throw r[1].error;
			var cr = {}, vid = {};
			(r[0].data || []).forEach(function (c) { cr[c.ad_id] = c; });
			(r[1].data || []).forEach(function (d) {
				var v = vid[d.ad_id] || (vid[d.ad_id] = { imp: 0, p25: 0, p50: 0, p75: 0, p100: 0 });
				v.imp += n(d.impressions); v.p25 += n(d.video_p25); v.p50 += n(d.video_p50); v.p75 += n(d.video_p75); v.p100 += n(d.video_p100);
			});
			render(ads, cr, vid);
		}).catch(function (err) {
			console.error("creativos:", err);
			$("#crGrid").empty().append($("<div>", { class: "col-12 text-danger" }).text("No se pudieron cargar los creativos."));
		});
	}

	jQuery(window).on("load", function () {
		$(document).on("click", ".range-tabs .nav-link", function () {
			var d = PRESET_DAYS[$(this).data("preset")];
			if (d && d !== days) { days = d; load(); }
		});
		$(document).on("change", "#homeClientSelect", function () { setTimeout(load, 0); });
		$(document).on("click", "#reloadMetrics", function () { load(); });
		setTimeout(load, 300);
	});
})(jQuery);
