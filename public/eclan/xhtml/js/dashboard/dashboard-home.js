/**
 * index.html como página de producto: Dashboard principal de Apache 360.
 * Dos fuentes de datos reales, nunca de relleno:
 *   - windsor-metrics (envuelve meta_daily_totals/meta_campaign_totals):
 *     campañas del período, gasto/clics por día, top campañas por gasto.
 *     Siempre en UNA moneda a la vez (selector arriba si hay más de una).
 *   - client_period_totals (RPC directo): impresiones/leads/conversaciones
 *     del período. Estas 4 SÍ se suman entre monedas (no son dinero); el
 *     gasto nunca se suma entre monedas distintas.
 * Selector de cliente (admin/manager, con "Todos") y de período (7/30/90)
 * son globales arriba y controlan todo lo demás de la página.
 */
(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;

	var $homeContent = $("#homeContent");
	var $authRequired = $("#authRequired");
	var $clientSelect = $("#homeClientSelect");
	var $subtitle = $("#homeSubtitle");

	var isViewer = false;
	var allClients = [];
	var currentPreset = "last_90d";
	var selectedCurrency = null;
	// Cliente elegido, compartido con otras páginas (p.ej. alertas.html).
	var CLIENT_KEY = "apache360.selectedClientId";
	var selectedClientId = "";
	try { selectedClientId = localStorage.getItem(CLIENT_KEY) || ""; } catch (e) {}
	var apexInstances = {};

	function daysFromPreset(preset) {
		if (preset === "last_7d") return 7;
		if (preset === "last_30d") return 30;
		return 90;
	}

	function compact(n) {
		return Number(n || 0).toLocaleString("es-ES");
	}

	// "hace X h" / "hace X días" — igual que clientes.js (ad_accounts.last_synced_at).
	function timeAgo(iso) {
		if (!iso) return null;
		var d = new Date(iso);
		if (isNaN(d.getTime())) return null;
		var hours = Math.floor((Date.now() - d.getTime()) / 3600000);
		if (hours < 1) return "hace menos de 1 h";
		if (hours < 24) return "hace " + hours + " h";
		var days = Math.floor(hours / 24);
		return "hace " + days + (days === 1 ? " día" : " días");
	}

	function axisLabels(labels) {
		return (labels || []).map(WindsorClient.shortDate);
	}

	// Copiado de analytics.js (línea por línea) — no hay módulo compartido
	// entre páginas Eclan, cada script es su propia IIFE.
	function lineChart(canvasId, labels, values, color, label, moneyAxis, currency) {
		var el = document.getElementById(canvasId);
		if (!el) return;
		el.height = 220;

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
								return label + ": " + (moneyAxis ? WindsorClient.money(ctx.parsed.y, currency) : WindsorClient.compact(ctx.parsed.y));
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
								return moneyAxis ? WindsorClient.money(v, currency) : WindsorClient.compact(v);
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

	var WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

	// Ads Engagement (Dom-Sáb): se calcula en el navegador a partir de la
	// serie diaria que ya trajo windsor-metrics — nunca se vuelve a
	// consultar meta_datos fila a fila para esto.
	function renderEngagementByWeekday(clickSummary) {
		var el = document.querySelector("#columnChart");
		if (!el) return;

		var totals = [0, 0, 0, 0, 0, 0, 0];
		var labels = (clickSummary && clickSummary.labels) || [];
		var values = (clickSummary && clickSummary.data) || [];
		labels.forEach(function (iso, i) {
			var d = new Date(iso + "T00:00:00");
			if (isNaN(d.getTime())) return;
			totals[d.getDay()] += Number(values[i] || 0);
		});

		if (apexInstances.column) apexInstances.column.destroy();
		el.innerHTML = "";
		apexInstances.column = new ApexCharts(el, {
			series: [{ name: "Clics", data: totals }],
			chart: { type: "bar", height: 250, toolbar: { show: false }, animations: { enabled: false } },
			plotOptions: { bar: { horizontal: false, columnWidth: "45%", borderRadius: 4 } },
			colors: ["#5856ce"],
			xaxis: {
				categories: WEEKDAY_LABELS,
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: { style: { colors: "#7e7e7e" } },
			},
			yaxis: { show: false },
			grid: { show: false },
			dataLabels: { enabled: false },
			legend: { show: false },
			fill: { opacity: 1 },
			tooltip: { y: { formatter: function (v) { return compact(v) + " clics"; } } },
		});
		apexInstances.column.render();
	}

	var TOP_CAMPAIGN_ACCENTS = ["bg-primary", "bg-info", "bg-success", "bg-secondary", "bg-warning"];

	// Reusa el patrón de barras del template, pero con campañas reales
	// (meta_campaign_totals, vía windsor-metrics) — todo por
	// createElement/textContent porque el nombre de campaña es dato real.
	function renderTopCampaigns(campaigns, currency) {
		var $container = $("#topCampaignsList");
		var top = (campaigns || []).slice().sort(function (a, b) { return b.spend - a.spend; }).slice(0, 5);

		if (!top.length) {
			$container.empty().append($("<p>", { class: "text-muted mb-0", text: "Sin datos de Meta todavía" }));
			return;
		}

		var maxSpend = top[0].spend || 1;
		$container.empty();
		top.forEach(function (c, i) {
			var pct = Math.max(4, Math.round((c.spend / maxSpend) * 100));
			var wrap = document.createElement("div");
			wrap.className = i === top.length - 1 ? "media align-items-center" : "media mb-4 align-items-center";

			var body = document.createElement("div");
			body.className = "media-body";
			// .media-body de este tema no trae min-width:0 — sin esto, el
			// ellipsis de .text-ov no se puede aplicar y el nombre largo de
			// una campaña real empuja el gasto fuera de la tarjeta.
			body.style.minWidth = "0";

			var top1 = document.createElement("div");
			top1.className = "d-flex justify-content-between";
			var name = document.createElement("span");
			name.className = "text-black font-w600 text-ov";
			// flex-shrink real: sin min-width:0 un hijo flex no se achica por
			// debajo de su contenido aunque tenga max-width + ellipsis, y el
			// nombre de campaña (dato real, puede ser largo) empuja el gasto
			// fuera de la tarjeta.
			name.style.minWidth = "0";
			name.style.flex = "1 1 auto";
			name.textContent = c.campaign;
			var spend = document.createElement("small");
			spend.className = "text-muted ms-2";
			spend.style.flex = "0 0 auto";
			spend.textContent = WindsorClient.money(c.spend, currency);
			top1.appendChild(name);
			top1.appendChild(spend);

			var progress = document.createElement("div");
			progress.className = "progress mt-2";
			progress.style.height = "8px";
			var bar = document.createElement("div");
			bar.className = "progress-bar " + TOP_CAMPAIGN_ACCENTS[i % TOP_CAMPAIGN_ACCENTS.length];
			bar.style.width = pct + "%";
			bar.style.height = "8px";
			bar.setAttribute("role", "progressbar");
			progress.appendChild(bar);

			body.appendChild(top1);
			body.appendChild(progress);
			wrap.appendChild(body);
			$container.append(wrap);
		});
	}

	function renderCurrencyBar(data) {
		var $bar = $("#homeCurrencyBar");
		var $select = $("#homeCurrencySelect");
		if (!data.currencies || data.currencies.length < 2) {
			$bar.addClass("d-none");
			return;
		}
		$select.empty();
		data.currencies.forEach(function (cur) {
			$select.append($("<option>", { value: cur, text: cur, selected: cur === data.currency }));
		});
		$bar.removeClass("d-none");
	}

	// Protegida contra división por cero (ayer sin gasto): sin ese guard,
	// pasar de $0 a cualquier gasto real daría un "+Infinity%".
	function pctChange(today, yesterday) {
		if (!yesterday) return null;
		return ((today - yesterday) / yesterday) * 100;
	}

	function renderSpendCards(data) {
		var labels = (data.spendSummary && data.spendSummary.labels) || [];
		var todayIso = labels[labels.length - 1];
		var yesterdayIso = labels[labels.length - 2];

		$("#spendTodayLabel").text("Gasto" + (todayIso ? " · " + WindsorClient.shortDate(todayIso) : ""));
		$("#spendYesterdayLabel").text("Gasto" + (yesterdayIso ? " · " + WindsorClient.shortDate(yesterdayIso) : ""));
		$("#spendTodayValue").text(WindsorClient.money(data.kpis.spendToday, data.currency));
		$("#spendYesterdayValue").text(WindsorClient.money(data.kpis.spendYesterday, data.currency));

		var pct = pctChange(data.kpis.spendToday, data.kpis.spendYesterday);
		var $pct = $("#spendTodayPct");
		var $icon = $("#spendTodayIcon i");
		if (pct == null) {
			$pct.text("—");
			$icon.attr("class", "fa fa-minus");
		} else {
			$pct.text((pct >= 0 ? "+" : "") + pct.toFixed(1) + "%");
			$icon.attr("class", pct >= 0 ? "fa fa-caret-up" : "fa fa-caret-down");
		}
	}

	function renderWindsorSection(data) {
		renderCurrencyBar(data);
		$("#kpiTotalCampaigns").text(compact(data.kpis.totalCampaigns));
		renderSpendCards(data);
		lineChart("activity", data.clickSummary.labels, data.clickSummary.data, "rgb(82, 177, 65)", "Clics", false);
		lineChart("activity2", data.spendSummary.labels, data.spendSummary.data, "rgb(236, 72, 153)", "Gasto", true, data.currency);
		renderTopCampaigns(data.campaigns, data.currency);
		renderEngagementByWeekday(data.clickSummary);
	}

	// Impresiones/leads/conversaciones: a diferencia del gasto, SÍ se suman
	// entre monedas (no son dinero) — una sola cifra aunque el cliente (o
	// "Todos") tenga cuentas en más de una moneda.
	function renderPeriodTotals(rows) {
		var filtered = selectedClientId ? rows.filter(function (r) { return r.client_id === selectedClientId; }) : rows;
		var impressions = 0, leads = 0, conversations = 0, hasLeads = false, hasConv = false;
		filtered.forEach(function (r) {
			impressions += Number(r.impressions || 0);
			if (r.leads != null) { leads += Number(r.leads); hasLeads = true; }
			if (r.messaging_conversations != null) { conversations += Number(r.messaging_conversations); hasConv = true; }
		});
		$("#kpiTotalAudience").text(compact(impressions));
		$("#kpiLeads").text(hasLeads ? compact(leads) : "—");
		$("#kpiMessagingConversations").text(hasConv ? compact(conversations) : "—");
	}

	// "Actualizado hace X h" — la MÁS ANTIGUA entre las cuentas visibles
	// (peor caso, no la más reciente): si una cuenta del cliente/alcance
	// actual no se ha sincronizado nunca, mejor decirlo que ocultarlo.
	function renderSyncSubtitle() {
		var accountsQuery = selectedClientId
			? supabase.from("v_client_accounts").select("account_id").eq("client_id", selectedClientId)
			: supabase.from("v_client_accounts").select("account_id");

		accountsQuery.then(function (res) {
			var accountIds = (res.data || []).map(function (r) { return r.account_id; });
			if (!accountIds.length) {
				$subtitle.text("Sin datos de Meta todavía");
				return;
			}
			return supabase.from("ad_accounts").select("last_synced_at").in("account_id", accountIds).then(function (resAcc) {
				var rows = resAcc.data || [];
				var withSync = rows.filter(function (r) { return r.last_synced_at; });
				if (!withSync.length) {
					$subtitle.text("Sin datos de Meta todavía");
					return;
				}
				var oldest = withSync.reduce(function (min, r) {
					return (!min || r.last_synced_at < min) ? r.last_synced_at : min;
				}, null);
				$subtitle.text("Actualizado " + timeAgo(oldest));
			});
		}).catch(function (err) {
			console.error("dashboard-home sync subtitle:", err);
		});
	}

	function loadDashboard() {
		if (typeof WindsorClient === "undefined") return;

		var windsorPromise = WindsorClient.fetchMetrics({
			datePreset: currentPreset,
			currency: selectedCurrency,
			clientId: selectedClientId || undefined,
		});
		var periodPromise = supabase.rpc("client_period_totals", { _days: daysFromPreset(currentPreset) });

		renderSyncSubtitle();

		Promise.all([windsorPromise, periodPromise]).then(function (results) {
			var data = results[0];
			var periodRes = results[1];
			selectedCurrency = data.currency;
			renderWindsorSection(data);
			renderPeriodTotals(periodRes.data || []);
			$(document).trigger("apache360:metrics", [data]);
		}).catch(function (err) {
			console.error("windsor-metrics:", err);
			$("#topCampaignsList").empty().append(
				$("<div>", { class: "alert alert-danger mb-0" }).text(
					"No se pudieron cargar los datos de Windsor.ai" +
						(err && err.status ? " (HTTP " + err.status + ")" : "") +
						": " + (err && err.message ? err.message : "error desconocido")
				)
			);
		});
	}

	function renderProfileSidebar(identity) {
		$("#profileSidebarEmail").text(identity.email || "");
		$("#profileSidebarRole").text(identity.label || "");

		var $list = $("#profileSidebarClientList").empty();
		if (!allClients.length) {
			$("#profileSidebarClientsTitle").text(isViewer ? "Cliente" : "Clientes");
			$list.append($("<li>", { class: "text-muted fs-13", text: "Sin clientes asignados" }));
			return;
		}
		$("#profileSidebarClientsTitle").text(isViewer ? "Cliente" : "Clientes (" + allClients.length + ")");
		allClients.forEach(function (c) {
			$list.append($("<li>", { class: "fs-13 mb-1 text-ov", text: c.name }));
		});
	}

	function loadClientSelector() {
		return supabase.from("audit_clients").select("id,name").order("name").then(function (res) {
			allClients = res.data || [];
			if (isViewer || allClients.length === 0) {
				$clientSelect.addClass("d-none");
				return;
			}
			$clientSelect.empty();
			$clientSelect.append($("<option>", { value: "", text: "Todos" }));
			allClients.forEach(function (c) {
				$clientSelect.append($("<option>", { value: c.id, text: c.name }));
			});
			if (selectedClientId && !allClients.some(function (c) { return c.id === selectedClientId; })) selectedClientId = "";
			$clientSelect.val(selectedClientId);
			$clientSelect.removeClass("d-none");
		});
	}

	// Nada de esto se ata a jQuery(window).on("load", ...): el tema (global.min.js
	// + custom.min.js) dispara su propio ciclo "load" interno y una excepción
	// ahí (bootstrap-select roto, ver custom.min.js) puede cortar el resto de
	// handlers atados a ese mismo evento. Igual que clientes.js: delegación de
	// eventos + arranque directos, sin esperar a window.load.
	$(document).on("change", "#homeCurrencySelect", function () {
		selectedCurrency = $(this).val();
		loadDashboard();
	});

	$(document).on("change", "#homeClientSelect", function () {
		selectedClientId = $(this).val();
		try { localStorage.setItem(CLIENT_KEY, selectedClientId); } catch (e) {}
		loadDashboard();
	});

	$(document).on("click", ".range-tabs .nav-link", function () {
		var preset = $(this).data("preset");
		if (!preset || preset === currentPreset) return;
		currentPreset = preset;
		$(".range-tabs .nav-link").removeClass("active");
		$('.range-tabs .nav-link[data-preset="' + preset + '"]').addClass("active");
		loadDashboard();
	});

	$(document).on("click", "#reloadMetrics", function () {
		loadDashboard();
	});

	// --- Arranque: sólo cargar si hay sesión ---
	AuditClient.getSession().then(function (session) {
		if (!session) {
			$homeContent.addClass("d-none");
			$authRequired.removeClass("d-none");
			window.location.replace("page-login.html");
			return;
		}
		AuditClient.getCurrentIdentity().then(function (identity) {
			isViewer = !!(identity && identity.role === "viewer");
			loadClientSelector().then(function () {
				renderProfileSidebar(identity || { email: "", label: "Sin acceso asignado" });
				loadDashboard();
			});
		});
	});
})(jQuery);
