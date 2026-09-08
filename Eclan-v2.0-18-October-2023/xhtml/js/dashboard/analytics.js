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

		var labels = (data.clickSummary && data.clickSummary.labels) || [];
		var desde = labels[0];
		var hasta = labels[labels.length - 1];
		var rango = desde && hasta ? WindsorClient.longDate(desde) + " – " + WindsorClient.longDate(hasta) : "";

		$("#rangeSubtitle").text(rango ? "Datos reales de Windsor.ai · " + rango : "Datos reales de Windsor.ai");
		$("#clickRangeLabel").text("Clics totales del período");
		$("#spendRangeLabel").text("Gasto total del período");

		var generado = new Date(data.generatedAt || Date.now());
		$("#headerTime").text(generado.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
		$("#headerDate").text("Actualizado " + generado.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }));
	}

	function axisLabels(labels) {
		return labels.map(WindsorClient.shortDate);
	}

	function lineChart(canvasId, labels, values, color, label, moneyAxis) {
		var el = document.getElementById(canvasId);
		if (!el) return;
		el.height = 300;

		var existing = Chart.getChart(el.id);
		if (existing) existing.destroy();

		new Chart(el.getContext("2d"), {
			type: "line",
			data: {
				labels: axisLabels(labels),
				datasets: [
					{
						label: label,
						data: values,
						borderColor: color,
						borderWidth: 2,
						backgroundColor: color.replace("rgb(", "rgba(").replace(")", ", 0.15)"),
						fill: true,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				elements: { point: { radius: 0, hitRadius: 12 }, line: { tension: 0.4 } },
				plugins: {
					legend: { display: false },
					tooltip: {
						mode: "index",
						intersect: false,
						callbacks: {
							label: function (ctx) {
								return label + ": " + (moneyAxis ? WindsorClient.money(ctx.parsed.y) : WindsorClient.compact(ctx.parsed.y));
							},
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						border: { display: false },
						grid: { color: "rgba(0,0,0,0.05)" },
						ticks: {
							color: "#7e7e7e",
							callback: function (v) {
								return moneyAxis ? WindsorClient.money(v) : WindsorClient.compact(v);
							},
						},
					},
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { color: "#7e7e7e", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
					},
				},
			},
		});
	}

	var apexInstances = {};

	function renderGoalStatistic(objectiveBreakdown, ctrGauge) {
		var circleEl = document.querySelector("#chartCircle");
		if (circleEl) {
			if (apexInstances.circle) apexInstances.circle.destroy();
			circleEl.innerHTML = "";
			apexInstances.circle = new ApexCharts(circleEl, {
				chart: { type: "radialBar", height: 340, animations: { enabled: false } },
				plotOptions: {
					radialBar: {
						hollow: { margin: 0, size: "35%", background: "transparent" },
						track: { show: true, background: "#eef0f7", strokeWidth: "10%", opacity: 1, margin: 14 },
						dataLabels: { name: { fontSize: "14px" }, value: { fontSize: "18px", formatter: function (v) { return v + "%"; } } },
					},
				},
				fill: { opacity: 1 },
				stroke: { lineCap: "round" },
				colors: ["#FF285C", "#5856CE", "#56C7CE"],
				series: objectiveBreakdown.series.length ? objectiveBreakdown.series : [0],
				labels: objectiveBreakdown.labels.length ? objectiveBreakdown.labels : ["Sin datos"],
				legend: { show: true, position: "bottom", fontSize: "13px", markers: { radius: 12 } },
			});
			apexInstances.circle.render();
		}

		var ratioEl = document.querySelector("#chartratio");
		if (ratioEl) {
			if (apexInstances.ratio) apexInstances.ratio.destroy();
			ratioEl.innerHTML = "";
			apexInstances.ratio = new ApexCharts(ratioEl, {
				series: [ctrGauge],
				chart: { height: 230, type: "radialBar", toolbar: { show: false }, animations: { enabled: false } },
				plotOptions: {
					radialBar: {
						startAngle: -100,
						endAngle: 260,
						hollow: { margin: 0, size: "70%", background: "#fff" },
						track: { background: "#eef0f7", strokeWidth: "100%", margin: 0 },
						dataLabels: {
							show: true,
							name: { offsetY: -10, show: true, color: "#888", fontSize: "15px" },
							value: {
								offsetY: -4,
								formatter: function (val) {
									return parseFloat(val).toFixed(2) + "%";
								},
								color: "#111",
								fontSize: "28px",
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
			});
			apexInstances.ratio.render();
		}
	}

	function renderEngagementChart(engagement) {
		var el = document.querySelector("#columnChart");
		if (!el) return;
		if (apexInstances.column) apexInstances.column.destroy();
		el.innerHTML = "";

		apexInstances.column = new ApexCharts(el, {
			series: engagement.series,
			chart: { type: "bar", height: 250, stacked: true, toolbar: { show: false }, animations: { enabled: false } },
			plotOptions: { bar: { horizontal: false, columnWidth: "45%", borderRadius: 4 } },
			colors: ["#ff285c", "#5856ce", "#56c7ce", "#ff9f00", "#2b98d6"],
			xaxis: {
				categories: axisLabels(engagement.categories),
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: { style: { colors: "#7e7e7e" }, hideOverlappingLabels: true },
			},
			yaxis: { show: false },
			grid: { show: false },
			dataLabels: { enabled: false },
			legend: { position: "bottom", offsetY: 5 },
			fill: { opacity: 1 },
			tooltip: { y: { formatter: function (v) { return WindsorClient.compact(v) + " clics"; } } },
		});
		apexInstances.column.render();
	}

	function toCsv(labels, values, header) {
		var lines = [header];
		for (var i = 0; i < labels.length; i++) lines.push(labels[i] + "," + values[i]);
		return lines.join("\n");
	}

	function download(name, contents) {
		var blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
		var a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = name;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	var currentPreset = "last_90d";
	var lastData = null;

	function setLoading(on) {
		$("#rangeSubtitle").text(on ? "Cargando datos de Windsor.ai…" : $("#rangeSubtitle").text());
		$(".range-tabs .nav-link").css("opacity", on ? 0.5 : 1);
	}

	function loadRealData() {
		if (typeof WindsorClient === "undefined") return;
		setLoading(true);

		WindsorClient.fetchMetrics({ datePreset: currentPreset })
			.then(function (data) {
				lastData = data;
				setLoading(false);
				renderKpis(data);
				lineChart("activity", data.clickSummary.labels, data.clickSummary.data, "rgb(82, 177, 65)", "Clics", false);
				lineChart("activity2", data.spendSummary.labels, data.spendSummary.data, "rgb(255, 142, 38)", "Gasto", true);
				renderGoalStatistic(data.objectiveBreakdown, data.ctrGauge);
				renderPlatformBreakdown(data.plataformas);
				renderEngagementChart(data.engagementByPlatform);
				renderAdList("#mostPerformedAdsList", data.topAds.slice(0, 3), "Clics");
				renderAdList("#trendingAdsList", data.topAds.slice(0, 3).reverse(), "Clics");
			})
			.catch(function (err) {
				setLoading(false);
				console.error("windsor-metrics:", err);
				$("#rangeSubtitle").text("No se pudieron cargar los datos de Windsor.ai");
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
		$(document).on("click", ".range-tabs .nav-link", function () {
			var preset = $(this).data("preset");
			if (!preset || preset === currentPreset) return;
			currentPreset = preset;
			$(".range-tabs .nav-link").removeClass("active");
			$('.range-tabs .nav-link[data-preset="' + preset + '"]').addClass("active");
			loadRealData();
		});

		$(document).on("click", "#reloadMetrics", function () {
			loadRealData();
		});

		$(document).on("click", "#downloadClicksCsv", function () {
			if (lastData) download("clics.csv", toCsv(lastData.clickSummary.labels, lastData.clickSummary.data, "fecha,clics"));
		});

		$(document).on("click", "#downloadSpendCsv", function () {
			if (lastData) download("gasto.csv", toCsv(lastData.spendSummary.labels, lastData.spendSummary.data, "fecha,gasto"));
		});

		setTimeout(loadRealData, 300);
	});
})(jQuery);
