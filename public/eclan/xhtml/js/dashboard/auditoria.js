(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined" || typeof AuditLib === "undefined") return;
	var supabase = AuditClient.supabase;

	// Mismas credenciales públicas que windsor-client.js (no hay build step
	// en estas páginas estáticas — la anon key está pensada para ser
	// pública en el cliente).
	var SUPABASE_URL = "https://szdivobcbdkiszgrizic.supabase.co";
	var SUPABASE_ANON_KEY = "sb_publishable_ldumgPigulWT8adpCHpa_Q_dLVy4EC-";

	var clientId = new URLSearchParams(window.location.search).get("client_id");

	var $loading = $("#auditLoading");
	var $content = $("#auditContent");
	var $migrationPending = $("#migrationPending");
	var $authRequired = $("#authRequired");
	var $clientNotFound = $("#clientNotFound");
	var $empty = $("#auditEmpty");
	var $tableCard = $("#auditTableCard");
	var $tableBody = $("#auditTableBody");
	var $kpis = $("#auditKpis");

	var auditModalEl = document.getElementById("auditModal");
	var deleteModalEl = document.getElementById("deleteAuditModal");
	var $auditFormError = $("#auditFormError");
	var deleteTargetId = null;
	var deleteTargetName = "";

	var dailyCampaignTotals = [];

	function showOnly($el) {
		[$loading, $content, $migrationPending, $authRequired, $clientNotFound].forEach(function ($x) { $x.addClass("d-none"); });
		if ($el) $el.removeClass("d-none");
	}

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	function money(n) {
		return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function num(n, decimals) {
		return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
	}

	// --- KPI widget-stat cards (mismo patrón que "Total Campaign" en analytics.html) ---
	function kpiCard(label, value, iconClass, bgClass) {
		return (
			'<div class="col-md-4 col-xl-2 col-6">' +
			'<div class="card widget-stat">' +
			'<div class="card-body p-3">' +
			'<div class="media align-items-center">' +
			'<div class="media-body">' +
			'<p class="fs-13 mb-1 wspace-no">' + label + "</p>" +
			'<h3 class="mb-0">' + value + "</h3>" +
			"</div>" +
			'<span class="ms-3 ' + bgClass + ' text-white">' +
			'<i class="' + iconClass + '"></i>' +
			"</span>" +
			"</div></div></div></div>"
		);
	}

	function renderKpis(rows) {
		var totalBudget = 0, totalSpent = 0, ok = 0, under = 0, over = 0;
		rows.forEach(function (r) {
			totalBudget += r.presupuesto_total;
			totalSpent += r.metrics.gastoActual;
			if (r.metrics.pacingStatus === "OK") ok++;
			else if (r.metrics.pacingStatus === "SUBGASTANDO") under++;
			else over++;
		});
		$kpis.html(
			kpiCard("Presupuesto total", money(totalBudget), "fa fa-usd", "bg-primary") +
			kpiCard("Gasto total", money(totalSpent), "fa fa-line-chart", "bg-info") +
			kpiCard("En ritmo", ok, "fa fa-check", "bg-success") +
			kpiCard("Subgastando", under, "fa fa-arrow-down", under > 0 ? "bg-warning" : "bg-success") +
			kpiCard("Sobregastando", over, "fa fa-arrow-up", over > 0 ? "bg-danger" : "bg-success")
		);
	}

	// --- Serie diaria agregada de una campaña, para los 4 gráficos ---
	function buildDailySeries(campaignRows) {
		var byDate = {};
		campaignRows.forEach(function (r) {
			var d = byDate[r.date] || { date: r.date, spend: 0, clicks: 0, impressions: 0, reach: 0 };
			d.spend += Number(r.spend || 0);
			d.clicks += Number(r.clicks || 0);
			d.impressions += Number(r.impressions || 0);
			d.reach += Number(r.reach || 0);
			byDate[r.date] = d;
		});
		var dates = Object.keys(byDate).sort();
		var cum = 0;
		return dates.map(function (date) {
			var d = byDate[date];
			cum += d.spend;
			return {
				date: date,
				spend: round2(d.spend),
				cumSpend: round2(cum),
				clicks: d.clicks,
				impressions: d.impressions,
				reach: d.reach,
				ctr: d.impressions > 0 ? round2((d.clicks / d.impressions) * 100) : 0,
				cpc: d.clicks > 0 ? round2(d.spend / d.clicks) : 0,
				cpm: d.impressions > 0 ? round2((d.spend / d.impressions) * 1000) : 0,
			};
		});
	}

	function round2(n) { return Math.round(n * 100) / 100; }

	function computePerf(campaignRows) {
		var clicks = 0, impressions = 0, spend = 0;
		campaignRows.forEach(function (r) {
			clicks += Number(r.clicks || 0);
			impressions += Number(r.impressions || 0);
			spend += Number(r.spend || 0);
		});
		return {
			clicks: clicks,
			impressions: impressions,
			ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
			cpc: clicks > 0 ? spend / clicks : 0,
		};
	}

	// --- Los 4 gráficos de la fila expandida, vía ApexCharts (vendorizado;
	// no ECharts, que sólo aplica al build de Vite/React) ---
	var CHART_BASE = {
		chart: { type: "line", height: 180, toolbar: { show: false }, animations: { enabled: false } },
		dataLabels: { enabled: false },
		stroke: { width: 2, curve: "smooth" },
		grid: { strokeDashArray: 4 },
		legend: { show: true, fontSize: "11px" },
		xaxis: { type: "category", labels: { style: { fontSize: "10px" } } },
	};

	function renderCharts(row) {
		var series = buildDailySeries(row.campaignRows);
		var dates = series.map(function (d) { return d.date; });
		if (typeof ApexCharts === "undefined" || !dates.length) return;

		var elSpend = document.querySelector("#chart-spend-" + row.id);
		if (elSpend) {
			new ApexCharts(elSpend, Object.assign({}, CHART_BASE, {
				series: [
					{ name: "Gasto acumulado", data: series.map(function (d) { return d.cumSpend; }) },
					{ name: "Presupuesto", data: series.map(function () { return row.presupuesto_total; }) },
				],
				stroke: { width: [2, 2], curve: "smooth", dashArray: [0, 4] },
				colors: ["#3AAFA9", "#ea4d4d"],
				xaxis: Object.assign({}, CHART_BASE.xaxis, { categories: dates }),
				title: { text: "Gasto acumulado", style: { fontSize: "12px" } },
			})).render();
		}

		var elPerf = document.querySelector("#chart-perf-" + row.id);
		if (elPerf) {
			new ApexCharts(elPerf, Object.assign({}, CHART_BASE, {
				series: [
					{ name: "Clics", data: series.map(function (d) { return d.clicks; }) },
					{ name: "Impresiones", data: series.map(function (d) { return d.impressions; }) },
					{ name: "Alcance", data: series.map(function (d) { return d.reach; }) },
				],
				colors: ["#3AAFA9", "#405189", "#f3b023"],
				xaxis: Object.assign({}, CHART_BASE.xaxis, { categories: dates }),
				title: { text: "Rendimiento", style: { fontSize: "12px" } },
			})).render();
		}

		var elEff = document.querySelector("#chart-eff-" + row.id);
		if (elEff) {
			new ApexCharts(elEff, Object.assign({}, CHART_BASE, {
				series: [
					{ name: "CTR %", data: series.map(function (d) { return d.ctr; }) },
					{ name: "CPC", data: series.map(function (d) { return d.cpc; }) },
					{ name: "CPM", data: series.map(function (d) { return d.cpm; }) },
				],
				colors: ["#3AAFA9", "#f3b023", "#7c4dff"],
				xaxis: Object.assign({}, CHART_BASE.xaxis, { categories: dates }),
				title: { text: "Eficiencia", style: { fontSize: "12px" } },
			})).render();
		}

		var elDaily = document.querySelector("#chart-daily-" + row.id);
		if (elDaily) {
			new ApexCharts(elDaily, Object.assign({}, CHART_BASE, {
				series: [{ name: "Gasto diario", data: series.map(function (d) { return d.spend; }) }],
				chart: Object.assign({}, CHART_BASE.chart, { type: "bar" }),
				colors: ["#3AAFA9"],
				xaxis: Object.assign({}, CHART_BASE.xaxis, { categories: dates }),
				title: { text: "Gasto diario", style: { fontSize: "12px" } },
			})).render();
		}
	}

	var chartsRenderedFor = {};

	function onRowExpanded(row) {
		if (chartsRenderedFor[row.id]) return;
		chartsRenderedFor[row.id] = true;
		renderCharts(row);
	}

	// --- Diagnóstico de IA (Edge Function audit-insight, sin JWT de usuario) ---
	function generateInsight(row) {
		var $btn = $("#ai-btn-" + row.id);
		var $out = $("#ai-out-" + row.id);
		var perf = computePerf(row.campaignRows);
		$btn.prop("disabled", true).html('<span class="spinner-border spinner-border-sm me-1"></span>Generando…');

		return fetch(SUPABASE_URL + "/functions/v1/audit-insight", {
			method: "POST",
			headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
			body: JSON.stringify({
				campaignData: {
					campaignName: row.campaign_name,
					platform: row.platform || "",
					presupuestoTotal: row.presupuesto_total.toFixed(2),
					gastoActual: row.metrics.gastoActual.toFixed(2),
					presupuestoRestante: row.metrics.presupuestoRestante.toFixed(2),
					diasTranscurridos: row.metrics.diasTranscurridos,
					diasRestantes: row.metrics.diasRestantes,
					pacingStatus: row.metrics.pacingStatus,
					pacingPct: row.metrics.pacingPct.toFixed(1),
					gastoDiarioActual: row.metrics.gastoDiarioActual.toFixed(2),
					presupuestoDiarioIdeal: row.metrics.presupuestoDiarioIdeal.toFixed(2),
					ctr: perf.ctr.toFixed(2),
					cpc: perf.cpc.toFixed(2),
					impressions: perf.impressions,
					clicks: perf.clicks,
					reach: (row.campaignRows || []).reduce(function (s, r) { return s + Number(r.reach || 0); }, 0),
				},
			}),
		})
			.then(function (res) { return res.json(); })
			.then(function (body) {
				var badge = body.riskLevel === "critical" ? '<span class="badge bg-danger me-2">Crítico</span>'
					: body.riskLevel === "moderate" ? '<span class="badge bg-warning me-2">Moderado</span>'
					: '<span class="badge bg-success me-2">Sin riesgo</span>';
				$out.html('<div class="alert alert-light border mt-2 mb-0">' + badge + escapeHtml(body.insight || "Sin diagnóstico.").replace(/\n/g, "<br>") + "</div>").removeClass("d-none");
			})
			.catch(function () {
				$out.html('<div class="alert alert-danger mt-2 mb-0">No se pudo generar el diagnóstico.</div>').removeClass("d-none");
			})
			.then(function () {
				$btn.prop("disabled", false).html('<i class="fa fa-magic me-1"></i>Generar diagnóstico IA');
			});
	}

	// --- Barra de ritmo: tiempo transcurrido (línea) vs. % gastado (barra) ---
	function pacingBar(row) {
		var pctTime = Math.min(100, Math.max(0, row.metrics.porcentajeTiempo));
		var pctSpent = Math.min(100, Math.max(0, row.metrics.porcentajeGastado));
		var barClass = row.metrics.pacingStatus === "OK" ? "bg-success" : row.metrics.pacingStatus === "SUBGASTANDO" ? "bg-warning" : "bg-danger";
		return (
			'<div class="mb-1 d-flex justify-content-between"><small>' + pctSpent.toFixed(0) + "% gastado</small><small>" + pctTime.toFixed(0) + "% del tiempo</small></div>" +
			'<div class="progress" style="height:8px;position:relative;">' +
			'<div class="progress-bar ' + barClass + '" role="progressbar" style="width:' + pctSpent + '%"></div>' +
			'<div style="position:absolute;top:-2px;left:' + pctTime + '%;width:2px;height:12px;background:#3d4465;"></div>' +
			"</div>"
		);
	}

	function statusBadge(status) {
		if (status === "OK") return '<span class="badge bg-success">En ritmo</span>';
		if (status === "SUBGASTANDO") return '<span class="badge bg-warning">Subgastando</span>';
		return '<span class="badge bg-danger">Sobregastando</span>';
	}

	function alertsBadges(alerts) {
		if (!alerts.length) return '<span class="text-muted fs-12">—</span>';
		return alerts.map(function (a) {
			var cls = a.severity === "danger" ? "bg-danger" : a.severity === "warning" ? "bg-warning" : "bg-info";
			return '<span class="badge ' + cls + ' me-1 mb-1" title="' + escapeHtml(a.message) + '">' + a.icon + "</span>";
		}).join("");
	}

	function pctCellClass(status) {
		return status === "OK" ? "text-success" : status === "SUBGASTANDO" ? "text-warning" : "text-danger";
	}

	// Celdas editables inline — se detiene la propagación del click para
	// que no dispare el toggle de la fila (data-bs-toggle="collapse" vive
	// en el <tr>).
	function inlineDateCell(row, field) {
		return '<td onclick="event.stopPropagation()">' +
			'<input type="date" class="form-control form-control-sm inline-edit" data-id="' + row.id + '" data-field="' + field + '" value="' + (row[field] || "") + '">' +
			"</td>";
	}

	function inlineCalendarCell(row) {
		var opts = [["corridos", "Todos los días"], ["lun_vie", "Lunes a viernes"], ["lun_sab", "Lunes a sábado"]];
		var html = opts.map(function (o) {
			return '<option value="' + o[0] + '"' + (row.tipo_calendario === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
		}).join("");
		return '<td onclick="event.stopPropagation()">' +
			'<select class="form-control form-control-sm inline-edit" data-id="' + row.id + '" data-field="tipo_calendario">' + html + "</select>" +
			"</td>";
	}

	function inlineBudgetCell(row) {
		return '<td onclick="event.stopPropagation()">' +
			'<input type="number" min="0" step="0.01" class="form-control form-control-sm inline-edit" data-id="' + row.id + '" data-field="presupuesto_total" value="' + row.presupuesto_total + '">' +
			"</td>";
	}

	function metricRow(label, value) {
		return '<div class="col-6 col-md-3 col-lg-2 mb-3">' +
			'<p class="fs-12 text-muted mb-0">' + label + "</p>" +
			'<h5 class="mb-0 font-w600">' + value + "</h5>" +
			"</div>";
	}

	function expandedRowHtml(r) {
		var perf = computePerf(r.campaignRows || []);
		var reach = (r.campaignRows || []).reduce(function (s, x) { return s + Number(x.reach || 0); }, 0);
		return (
			'<tr class="collapse" id="exp-' + r.id + '" data-audit-id="' + r.id + '">' +
			'<td colspan="16" class="p-0 bg-light">' +
			'<div class="audit-expanded-panel">' +
			'<div class="mb-3">' + pacingBar(r) + "</div>" +
			'<div class="row" id="charts-row-' + r.id + '">' +
			'<div class="col-md-6 col-xl-3 mb-3"><div id="chart-spend-' + r.id + '"></div></div>' +
			'<div class="col-md-6 col-xl-3 mb-3"><div id="chart-perf-' + r.id + '"></div></div>' +
			'<div class="col-md-6 col-xl-3 mb-3"><div id="chart-eff-' + r.id + '"></div></div>' +
			'<div class="col-md-6 col-xl-3 mb-3"><div id="chart-daily-' + r.id + '"></div></div>' +
			"</div>" +
			'<div class="row mt-2">' +
			metricRow("Impresiones", num(perf.impressions)) +
			metricRow("Alcance", num(reach)) +
			metricRow("Clics", num(perf.clicks)) +
			metricRow("CTR", perf.ctr.toFixed(2) + "%") +
			metricRow("CPC", money(perf.cpc)) +
			metricRow("Días totales / transc. / rest.", r.metrics.diasTotales + " / " + r.metrics.diasTranscurridos + " / " + r.metrics.diasRestantes) +
			"</div>" +
			'<div class="d-flex align-items-center flex-wrap gap-2 mt-2">' +
			'<button type="button" class="btn btn-outline-primary btn-sm ai-insight-btn" id="ai-btn-' + r.id + '" data-id="' + r.id + '">' +
			'<i class="fa fa-magic me-1"></i>Generar diagnóstico IA</button>' +
			"</div>" +
			'<div id="ai-out-' + r.id + '" class="d-none"></div>' +
			"</div></td></tr>"
		);
	}

	function renderTable(rows) {
		if (!rows.length) {
			$tableCard.addClass("d-none");
			$empty.removeClass("d-none");
			return;
		}
		$empty.addClass("d-none");
		$tableCard.removeClass("d-none");
		chartsRenderedFor = {};
		$tableBody.html(rows.map(function (r) {
			return (
				'<tr class="audit-row" data-bs-toggle="collapse" data-bs-target="#exp-' + r.id + '" aria-expanded="false" aria-controls="exp-' + r.id + '">' +
				'<td><i class="fa fa-chevron-right audit-chevron"></i></td>' +
				"<td>" + (r.platform ? '<span class="badge bg-secondary">' + escapeHtml(r.platform) + "</span>" : '<span class="text-muted">—</span>') + "</td>" +
				'<td><strong class="text-ov d-inline-block" style="max-width:200px;">' + escapeHtml(r.campaign_name) + "</strong></td>" +
				'<td class="text-muted">—</td>' +
				inlineDateCell(r, "fecha_inicio") +
				inlineDateCell(r, "fecha_fin") +
				inlineCalendarCell(r) +
				inlineBudgetCell(r) +
				"<td>" + money(r.metrics.gastoActual) + "</td>" +
				"<td>" + r.metrics.porcentajeTiempo.toFixed(0) + "%</td>" +
				'<td class="' + pctCellClass(r.metrics.pacingStatus) + ' fw-bold">' + r.metrics.porcentajeGastado.toFixed(0) + "%</td>" +
				"<td>" + money(r.metrics.presupuestoDiarioIdeal) + "</td>" +
				"<td>" + money(r.metrics.presupuestoRestante) + "</td>" +
				"<td>" + statusBadge(r.metrics.pacingStatus) + "</td>" +
				"<td>" + alertsBadges(r.alerts) + "</td>" +
				'<td class="text-end" onclick="event.stopPropagation()">' +
				'<a href="javascript:;" class="btn btn-light btn-sm sharp me-1 edit-audit-btn" data-id="' + r.id + '"><i class="fa fa-pencil"></i></a>' +
				'<a href="javascript:;" class="btn btn-light btn-sm sharp delete-audit-btn" data-id="' + r.id + '" data-name="' + escapeHtml(r.campaign_name) + '"><i class="fa fa-trash text-danger"></i></a>' +
				"</td>" +
				"</tr>" +
				expandedRowHtml(r)
			);
		}).join(""));
	}

	var currentRecords = [];
	var currentRowsById = {};

	function loadAndRender() {
		return supabase.from("audit_records").select("*").eq("client_id", clientId).order("created_at", { ascending: true })
			.then(function (res) {
				if (res.error) {
					showOnly($migrationPending);
					throw res.error;
				}
				currentRecords = res.data || [];
				var rows = AuditLib.buildAuditRows(currentRecords, dailyCampaignTotals);
				currentRowsById = {};
				rows.forEach(function (r) { currentRowsById[r.id] = r; });
				renderKpis(rows);
				renderTable(rows);
				showOnly($content);
			});
	}

	function loadWindsorData() {
		return WindsorClient.fetchMetrics({ raw: true, clientId: clientId }).then(function (data) {
			dailyCampaignTotals = data.dailyCampaignTotals || [];
			var campaignNames = data.campaignNames || [];
			$("#campaignOptions").html(campaignNames.map(function (c) {
				return '<option value="' + escapeHtml(c) + '"></option>';
			}).join(""));
		}).catch(function (err) {
			console.error("windsor-metrics:", err);
			dailyCampaignTotals = [];
		});
	}

	function openCreateModal() {
		$("#auditForm")[0].reset();
		$("#auditId").val("");
		$("#auditCalendar").val("corridos");
		$("#auditModalTitle").text("Nueva auditoría");
		$auditFormError.addClass("d-none");
	}

	function openEditModal(id) {
		var rec = currentRecords.filter(function (r) { return String(r.id) === String(id); })[0];
		if (!rec) return;
		$("#auditId").val(rec.id);
		$("#auditCampaign").val(rec.campaign_name);
		$("#auditBudget").val(rec.presupuesto_total);
		$("#auditCalendar").val(rec.tipo_calendario);
		$("#auditStart").val(rec.fecha_inicio);
		$("#auditEnd").val(rec.fecha_fin);
		$("#auditModalTitle").text("Editar auditoría");
		$auditFormError.addClass("d-none");
		bootstrap.Modal.getOrCreateInstance(auditModalEl).show();
	}

	function saveAudit() {
		var id = $("#auditId").val();
		var campaign = $("#auditCampaign").val().trim();
		var budget = parseFloat($("#auditBudget").val());
		var calendar = $("#auditCalendar").val();
		var start = $("#auditStart").val();
		var end = $("#auditEnd").val();

		if (!campaign || !budget || !start || !end) {
			$auditFormError.text("Completa todos los campos.").removeClass("d-none");
			return;
		}
		if (end < start) {
			$auditFormError.text("La fecha de fin debe ser posterior a la de inicio.").removeClass("d-none");
			return;
		}

		var payload = {
			client_id: clientId,
			campaign_name: campaign,
			presupuesto_total: budget,
			fecha_inicio: start,
			fecha_fin: end,
			tipo_calendario: calendar,
		};

		var query;
		if (id) {
			query = supabase.from("audit_records").update(payload).eq("id", id);
		} else {
			query = supabase.auth.getUser().then(function (userRes) {
				payload.user_id = userRes.data && userRes.data.user && userRes.data.user.id;
				return supabase.from("audit_records").insert(payload);
			});
		}

		Promise.resolve(query).then(function (res) {
			if (res.error) {
				$auditFormError.text("Error al guardar la auditoría.").removeClass("d-none");
				return;
			}
			bootstrap.Modal.getOrCreateInstance(auditModalEl).hide();
			loadAndRender();
		});
	}

	function deleteAudit() {
		if (!deleteTargetId) return;
		supabase.from("audit_records").delete().eq("id", deleteTargetId).then(function () {
			bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
			deleteTargetId = null;
			loadAndRender();
		});
	}

	// --- Eventos ---
	$("#newAuditBtn").on("click", openCreateModal);
	$("#retryLoadBtn").on("click", function () { window.location.reload(); });
	$("#auditFormSubmit").on("click", saveAudit);
	$("#confirmDeleteAuditBtn").on("click", deleteAudit);
	$(document).on("click", ".edit-audit-btn", function () { openEditModal($(this).data("id")); });
	$(document).on("click", ".delete-audit-btn", function () {
		deleteTargetId = $(this).data("id");
		deleteTargetName = $(this).data("name");
		$("#deleteAuditName").text(deleteTargetName);
		bootstrap.Modal.getOrCreateInstance(deleteModalEl).show();
	});
	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	// Edición inline: fecha inicio/fin, cronograma y presupuesto directo en la fila.
	$(document).on("change", ".inline-edit", function () {
		var $el = $(this), id = $el.data("id"), field = $el.data("field");
		var value = field === "presupuesto_total" ? parseFloat($el.val()) : $el.val();
		if (field === "presupuesto_total" && (isNaN(value) || value < 0)) { $el.addClass("is-invalid"); return; }
		var patch = {}; patch[field] = value;
		$el.removeClass("is-invalid").prop("disabled", true);
		supabase.from("audit_records").update(patch).eq("id", id).then(function (res) {
			if (res.error) { $el.prop("disabled", false).addClass("is-invalid"); return; }
			loadAndRender();
		});
	});

	// Fila expandida: renderiza los 4 gráficos la primera vez que se abre.
	$(document).on("shown.bs.collapse", "tr.collapse", function () {
		var id = $(this).data("audit-id");
		var row = currentRowsById[id];
		if (row) onRowExpanded(row);
	});

	// Diagnóstico de IA por campaña
	$(document).on("click", ".ai-insight-btn", function () {
		var id = $(this).data("id");
		var row = currentRowsById[id];
		if (row) generateInsight(row);
	});

	// --- Arranque ---
	if (!clientId) {
		showOnly($clientNotFound);
	} else {
		AuditClient.getSession().then(function (session) {
			if (!session) {
				showOnly($authRequired);
				window.location.replace("page-login.html");
				return;
			}
			showOnly($loading);
			supabase.from("audit_clients").select("id, name, description").eq("id", clientId).maybeSingle()
				.then(function (res) {
					if (res.error) { showOnly($migrationPending); return; }
					if (!res.data) { showOnly($clientNotFound); return; }
					$("#clientTitle").text(res.data.name);
					if (res.data.description) $("#clientSubtitle").text(res.data.description);
					return loadWindsorData().then(loadAndRender);
				})
				.catch(function (err) { console.error(err); });
		});
	}
})(jQuery);
