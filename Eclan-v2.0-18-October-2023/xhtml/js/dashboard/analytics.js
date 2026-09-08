(function ($) {
	/* "use strict" */

	// ------------------------------------------------------------------
	// Datos reales desde Windsor.ai (vía Supabase Edge Function
	// "windsor-metrics"). Mapeo confirmado en el análisis de Paso 1:
	//
	//  - Click Summary (#activity)      -> clicks reales por día
	//  - Resumen de Gasto (#activity2)  -> gasto real por día
	//    (el template original decía "Conversion Summary", pero Windsor
	//    no trae ningún campo de conversiones en esta cuenta — solo
	//    clicks/spend/impressions/cpc/cpm. Se renombró el panel para no
	//    mostrar un número inventado.)
	//  - Goal Statistic (#chartCircle)  -> % de clicks por objetivo de
	//    campaña (campaign_objective)
	//  - #chartratio                    -> CTR global (clicks/impressions)
	//  - Bloque Instagram/Facebook/Twitter -> reemplazado por una fila por
	//    plataforma conectada en plataformas.ts (Gasto/Clics/Impresiones/CTR)
	//  - Ads Engagement (#columnChart)  -> clicks por día y por plataforma
	//  - Most Performed Ads / Trending Ads -> top anuncios por gasto real
	//  - KPIs (Total Campaign, Total Impresiones, Spends Today/Yesterday)
	// ------------------------------------------------------------------

	var PLATFORM_ICONS = {
		facebook: { icon: "la-facebook-f", bg: "bgl-info", text: "text-info" },
		instagram: { icon: "la-instagram", bg: "bgl-secondary", text: "text-secondary" },
		twitter_ads: { icon: "la-twitter", bg: "bgl-success", text: "text-success" },
		google_ads: { icon: "la-google", bg: "bgl-danger", text: "text-danger" },
		tiktok_ads: { icon: "la-tiktok", bg: "bgl-dark", text: "text-dark" },
		linkedin_ads: { icon: "la-linkedin", bg: "bgl-primary", text: "text-primary" },
	};

	function iconFor(id) {
		return PLATFORM_ICONS[id] || { icon: "la-chart-bar", bg: "bgl-primary", text: "text-primary" };
	}

	function renderPlatformBreakdown(plataformas) {
		var $container = $("#platformBreakdownList");
		if ($container.length === 0) return;

		var html = plataformas
			.map(function (p) {
				var meta = iconFor(p.id);
				var estado = p.conectado
					? ""
					: '<span class="badge badge-secondary ms-2">No conectado</span>';
				return (
					'<div>' +
					'<div class="d-flex align-items-center pb-3 mb-3 border-bottom">' +
					'<i class="lab ' + meta.icon + ' gs-icon ' + meta.bg + " " + meta.text + ' me-3"></i>' +
					'<span class="text-black fs-16 font-w600">' + p.nombre + estado + "</span>" +
					"</div>" +
					'<div class="fs-14 mb-4">' +
					'<ul class="d-flex justify-content-between pb-2"><li class="font-w500 text-dark">Gasto</li><li>' +
					WindsorClient.money(p.spend) +
					"</li></ul>" +
					'<ul class="d-flex justify-content-between pb-2"><li class="font-w500 text-dark">Clics</li><li>' +
					WindsorClient.compact(p.clicks) +
					"</li></ul>" +
					'<ul class="d-flex justify-content-between pb-2"><li class="font-w500 text-dark">Impresiones</li><li>' +
					WindsorClient.compact(p.impressions) +
					"</li></ul>" +
					'<ul class="d-flex justify-content-between pb-2"><li class="font-w500 text-dark">CPC</li><li>' +
					WindsorClient.money(p.cpc) +
					"</li></ul>" +
					"</div>" +
					"</div>"
				);
			})
			.join("");

		$container.html(html);
	}

	function renderAdList(selector, ads, valueLabel) {
		var $container = $(selector);
		if ($container.length === 0) return;

		if (!ads.length) {
			$container.html('<p class="text-muted mb-0">Sin datos de anuncios en el rango consultado.</p>');
			return;
		}

		var html = ads
			.map(function (ad, i) {
				var last = i === ads.length - 1;
				return (
					'<div class="row mb-4' + (last ? "" : " border-bottom") + ' sp10 align-items-center">' +
					'<div class="mb-4 col-md-7 col-sm-6 col-xxl-5">' +
					'<p class="text-primary mb-1">' + ad.campaign + "</p>" +
					'<h3 class="fs-18 mb-2 text-ov">' + ad.adName + "</h3>" +
					'<span class="fs-13 text-muted">' + ad.datasource + "</span>" +
					"</div>" +
					'<div class="d-flex col-md-5 col-sm-6 col-xxl-7 align-items-center justify-content-between">' +
					'<div class="d-flex mb-4 align-items-center">' +
					"<div><h3 class=\"fs-20 text-black mb-0\">" + WindsorClient.money(ad.spend) + "</h3>" +
					'<span class="fs-14">Gasto</span></div>' +
					"</div>" +
					'<div class="d-flex mb-4 align-items-center">' +
					"<div><h3 class=\"fs-20 text-black mb-0\">" + WindsorClient.compact(ad.clicks) + "</h3>" +
					'<span class="fs-14">' + valueLabel + "</span></div>" +
					"</div>" +
					"</div>" +
					"</div>"
				);
			})
			.join("");

		$container.html(html);
	}

	function renderKpis(data) {
		$("#kpiTotalCampaigns").text(WindsorClient.compact(data.kpis.totalCampaigns));
		$("#kpiTotalImpressions").text(WindsorClient.compact(data.kpis.totalImpressions));
		$("#kpiSpendYesterday").text(WindsorClient.money(data.kpis.spendYesterday));
		$("#kpiSpendToday").text(WindsorClient.money(data.kpis.spendToday));
		$("#kpiClickSummaryTotal").text(WindsorClient.compact(data.kpis.totalClicks));
		$("#kpiSpendSummaryTotal").text(WindsorClient.money(data.kpis.totalSpend));
	}

	function renderClickSummaryChart(clickSummary) {
		var el = document.getElementById("activity");
		if (!el) return;
		el.height = 300;

		var config = {
			type: "line",
			data: {
				labels: clickSummary.labels,
				datasets: [
					{
						label: "Clicks",
						data: clickSummary.data,
						borderColor: "rgba(26, 51, 213, 0)",
						backgroundColor: "rgba(82, 177, 65, 1)",
						fill: true,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				elements: { point: { radius: 0 }, line: { tension: 0.4 } },
				plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
				scales: {
					y: { ticks: { fontColor: "#3e4954", beginAtZero: true } },
					x: { gridLines: { display: false }, ticks: { fontColor: "#3e4954" } },
				},
			},
		};

		var existing = Chart.getChart(el.id);
		if (existing) existing.destroy();
		new Chart(el.getContext("2d"), config);
	}

	function renderSpendSummaryChart(spendSummary) {
		var el = document.getElementById("activity2");
		if (!el) return;
		el.height = 300;

		var config = {
			type: "line",
			data: {
				labels: spendSummary.labels,
				datasets: [
					{
						label: "Gasto",
						data: spendSummary.data,
						borderColor: "rgba(26, 51, 213, 0)",
						backgroundColor: "rgba(255, 142, 38, 1)",
						fill: true,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				elements: { line: { tension: 0.4 } },
				plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
				scales: {
					y: { ticks: { fontColor: "#3e4954", beginAtZero: true } },
					x: { gridLines: { display: false }, ticks: { fontColor: "#3e4954" } },
				},
			},
		};

		var existing = Chart.getChart(el.id);
		if (existing) existing.destroy();
		new Chart(el.getContext("2d"), config);
	}

	function renderGoalStatistic(objectiveBreakdown, ctrGauge) {
		var circleEl = document.querySelector("#chartCircle");
		if (circleEl) {
			circleEl.innerHTML = "";
			var optionsCircle = {
				chart: { type: "radialBar", height: 370, offsetY: 0, offsetX: 0 },
				plotOptions: {
					radialBar: {
						hollow: { margin: 0, size: "35%", background: "transparent" },
						track: { show: true, background: "#e1e5ff", strokeWidth: "10%", opacity: 1, margin: 17 },
					},
				},
				fill: { opacity: 1 },
				stroke: { lineCap: "round" },
				colors: ["#FF285C", "#5856CE", "#56C7CE"],
				series: objectiveBreakdown.series.length ? objectiveBreakdown.series : [0],
				labels: objectiveBreakdown.labels.length ? objectiveBreakdown.labels : ["Sin datos"],
				legend: { show: false },
			};
			new ApexCharts(circleEl, optionsCircle).render();
		}

		var ratioEl = document.querySelector("#chartratio");
		if (ratioEl) {
			ratioEl.innerHTML = "";
			var options = {
				series: [ctrGauge],
				chart: { height: 250, type: "radialBar", toolbar: { show: false } },
				plotOptions: {
					radialBar: {
						startAngle: -100,
						endAngle: 260,
						hollow: { margin: 0, size: "70%", background: "#fff" },
						track: { background: "#e1e5ff", strokeWidth: "100%", margin: 0 },
						dataLabels: {
							show: true,
							name: { offsetY: -10, show: true, color: "#888", fontSize: "17px" },
							value: {
								offsetY: -4,
								formatter: function (val) {
									return parseFloat(val).toFixed(1) + "%";
								},
								color: "#111",
								fontSize: "30px",
								show: true,
							},
						},
					},
				},
				fill: {
					type: "gradient",
					gradient: {
						shade: "dark",
						type: "horizontal",
						shadeIntensity: 0.5,
						gradientToColors: ["#5856CE"],
						inverseColors: true,
						opacityFrom: 1,
						opacityTo: 1,
						stops: [0, 100],
					},
				},
				stroke: { dashArray: 4 },
				labels: ["CTR"],
			};
			new ApexCharts(ratioEl, options).render();
		}
	}

	function renderEngagementChart(engagement) {
		var el = document.querySelector("#columnChart");
		if (!el) return;
		el.innerHTML = "";

		var options = {
			series: engagement.series,
			chart: { type: "bar", height: 250, stacked: true, toolbar: { show: false } },
			plotOptions: { bar: { horizontal: false, columnWidth: "20%" } },
			colors: ["#ff285c", "#5856ce", "#56c7ce", "#ff9f00", "#2b98d6"],
			xaxis: { categories: engagement.categories },
			yaxis: { show: false },
			grid: { show: false },
			dataLabels: { enabled: false },
			legend: { position: "bottom", offsetY: 5 },
			fill: { opacity: 1 },
		};

		new ApexCharts(el, options).render();
	}

	function loadRealData() {
		if (typeof WindsorClient === "undefined") return;

		WindsorClient.fetchMetrics({ datePreset: "last_90d" })
			.then(function (data) {
				renderKpis(data);
				renderClickSummaryChart(data.clickSummary);
				renderSpendSummaryChart(data.spendSummary);
				renderGoalStatistic(data.objectiveBreakdown, data.ctrGauge);
				renderPlatformBreakdown(data.plataformas);
				renderEngagementChart(data.engagementByPlatform);
				renderAdList("#mostPerformedAdsList", data.topAds.slice(0, 3), "Clics");
				renderAdList("#trendingAdsList", data.topAds.slice(0, 3).reverse(), "Clics");
			})
			.catch(function (err) {
				console.error("windsor-metrics:", err);
				var $container = $("#platformBreakdownList");
				if ($container.length) {
					$container.html(
						'<div class="alert alert-danger mb-0">No se pudieron cargar los datos de Windsor.ai' +
							(err && err.status ? " (HTTP " + err.status + ")" : "") +
							": " +
							(err && err.message ? err.message : "error desconocido") +
							"</div>"
					);
				}
			});
	}

	jQuery(window).on("load", function () {
		setTimeout(loadRealData, 300);
	});
})(jQuery);
