(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined" || typeof AuditLib === "undefined") return;
	var supabase = AuditClient.supabase;

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

	// --- KPI widget-stat cards (mismo patrón que "Total Campaign" en analytics.html) ---
	function kpiCard(label, value, iconClass, bgClass) {
		return (
			'<div class="col-md-6 col-xl-3 col-6">' +
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
			kpiCard("Fuera de ritmo", under + over, "fa fa-exclamation-triangle", (under + over) > 0 ? "bg-warning" : "bg-success")
		);
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

	function renderTable(rows) {
		if (!rows.length) {
			$tableCard.addClass("d-none");
			$empty.removeClass("d-none");
			return;
		}
		$empty.addClass("d-none");
		$tableCard.removeClass("d-none");
		$tableBody.html(rows.map(function (r) {
			return (
				"<tr>" +
				'<td><strong class="text-ov d-inline-block" style="max-width:220px;">' + escapeHtml(r.campaign_name) + "</strong></td>" +
				"<td>" + money(r.presupuesto_total) + "</td>" +
				"<td>" + money(r.metrics.gastoActual) + "</td>" +
				"<td>" + pacingBar(r) + "</td>" +
				"<td>" + statusBadge(r.metrics.pacingStatus) + "</td>" +
				"<td>" + alertsBadges(r.alerts) + "</td>" +
				'<td class="text-end">' +
				'<a href="javascript:;" class="btn btn-light btn-sm sharp me-1 edit-audit-btn" data-id="' + r.id + '"><i class="fa fa-pencil"></i></a>' +
				'<a href="javascript:;" class="btn btn-light btn-sm sharp delete-audit-btn" data-id="' + r.id + '" data-name="' + escapeHtml(r.campaign_name) + '"><i class="fa fa-trash text-danger"></i></a>' +
				"</td>" +
				"</tr>"
			);
		}).join(""));
	}

	var currentRecords = [];

	function loadAndRender() {
		return supabase.from("audit_records").select("*").eq("client_id", clientId).order("created_at", { ascending: true })
			.then(function (res) {
				if (res.error) {
					showOnly($migrationPending);
					throw res.error;
				}
				currentRecords = res.data || [];
				var rows = AuditLib.buildAuditRows(currentRecords, dailyCampaignTotals);
				renderKpis(rows);
				renderTable(rows);
				showOnly($content);
			});
	}

	function loadWindsorData() {
		return WindsorClient.fetchMetrics({ raw: true }).then(function (data) {
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
