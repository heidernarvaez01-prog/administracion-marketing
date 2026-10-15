// Tarjetas del Dashboard que venían de Analítica (Objetivos y CTR, anuncios
// con más gasto, anuncios en tendencia). Usa los mismos datos que ya pide
// dashboard-home.js (evento apache360:metrics), sin una segunda consulta.
(function ($) {
	"use strict";
	var apex = {};

	function renderGoal(ob, ctr) {
		var c = document.querySelector("#chartCircle");
		if (c && window.ApexCharts) {
			if (apex.c) apex.c.destroy();
			c.innerHTML = "";
			apex.c = new ApexCharts(c, {
				chart: { type: "radialBar", height: 320, animations: { enabled: false } },
				plotOptions: { radialBar: { hollow: { size: "35%" }, track: { background: "#eef0f7", margin: 10 },
					dataLabels: { name: { fontSize: "14px" }, value: { fontSize: "18px", formatter: function (v) { return v + "%"; } } } } },
				stroke: { lineCap: "round" }, colors: ["#FF285C", "#5856CE", "#56C7CE"],
				series: ob && ob.series.length ? ob.series : [0],
				labels: ob && ob.labels.length ? ob.labels : ["Sin datos"],
				legend: { show: true, position: "bottom", fontSize: "13px" },
			});
			apex.c.render();
		}
		var r = document.querySelector("#chartratio");
		if (r && window.ApexCharts) {
			if (apex.r) apex.r.destroy();
			r.innerHTML = "";
			apex.r = new ApexCharts(r, {
				series: [ctr || 0], chart: { height: 220, type: "radialBar", animations: { enabled: false } },
				plotOptions: { radialBar: { hollow: { size: "65%", background: "#fff" }, track: { background: "#eef0f7" },
					dataLabels: { name: { offsetY: -8, color: "#888", fontSize: "14px" }, value: { offsetY: -2, fontSize: "24px", color: "#111",
						formatter: function (v) { return parseFloat(v).toFixed(2) + "%"; } } } } },
				colors: ["#5856CE"], labels: ["CTR"],
			});
			apex.r.render();
		}
	}

	function renderAds(sel, ads, currency) {
		var $c = $(sel).empty();
		if (!ads || !ads.length) { $c.append($("<p>", { class: "text-muted", text: "Sin datos de anuncios en el período." })); return; }
		ads.forEach(function (ad, i) {
			var $row = $("<div>", { class: "d-flex align-items-center gap-3 pb-3 mb-3" + (i < ads.length - 1 ? " border-bottom" : "") });
			var $txt = $("<div>", { class: "flex-grow-1", style: "min-width:0" }).append(
				$("<p>", { class: "text-primary mb-1 fs-13 text-truncate", title: ad.campaign, text: ad.campaign }),
				$("<h4>", { class: "fs-16 mb-0 text-black text-truncate", title: ad.adName, text: ad.adName }));
			var $nums = $("<div>", { class: "d-flex gap-4 text-end flex-shrink-0" }).append(
				$("<div>").append($("<div>", { class: "fs-16 font-w600 text-black text-nowrap", text: WindsorClient.money(ad.spend, currency) }), $("<span>", { class: "fs-13", text: "Gasto" })),
				$("<div>").append($("<div>", { class: "fs-16 font-w600 text-black text-nowrap", text: WindsorClient.compact(ad.clicks) }), $("<span>", { class: "fs-13", text: "Clics" })));
			$c.append($row.append($txt, $nums));
		});
	}

	$(document).on("apache360:metrics", function (e, data) {
		if (!data) return;
		renderGoal(data.objectiveBreakdown, data.ctrGauge);
		renderAds("#mostPerformedAdsList", (data.topAds || []).slice(0, 5), data.currency);
		renderAds("#trendingAdsList", (data.trendingAds || []).slice(0, 5), data.currency);
	});
})(jQuery);
