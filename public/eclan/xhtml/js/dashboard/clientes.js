(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;

	var $loading = $("#clientsLoading");
	var $empty = $("#clientsEmpty");
	var $grid = $("#clientsGrid");
	var $migrationPending = $("#migrationPending");
	var $authRequired = $("#authRequired");

	var $summary = $("#clientsSummary");
	var $alertBanner = $("#clientsAlertBanner");
	var allClients = [];
	var statsByClient = {};

	var $clientModal = $("#clientModal");
	var clientModalEl = document.getElementById("clientModal");
	var deleteModalEl = document.getElementById("deleteClientModal");
	var $clientForm = $("#clientForm");
	var $clientFormError = $("#clientFormError");
	var deleteTargetId = null;

	function showOnly($el) {
		$loading.addClass("d-none");
		$empty.addClass("d-none");
		$grid.addClass("d-none");
		$migrationPending.addClass("d-none");
		if ($el) $el.removeClass("d-none");
	}

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	function initials(name) {
		var parts = String(name || "").trim().split(/\s+/).slice(0, 2);
		var letters = parts.map(function (w) { return (w[0] || "").toUpperCase(); }).join("");
		return letters || "·";
	}

	var ACCENTS = ["bg-primary", "bg-info", "bg-success", "bg-secondary", "bg-warning", "bg-danger"];

	function money(n) {
		var v = Number(n || 0);
		return "$" + v.toLocaleString("es-CO", { maximumFractionDigits: 0 });
	}

	function fmtDate(iso) {
		if (!iso) return "—";
		var d = new Date(iso);
		if (isNaN(d.getTime())) return "—";
		return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
	}

	function renderSummary(clients) {
		var campaigns = 0, budget = 0, spent = 0, atRisk = 0, criticalAlerts = 0;
		clients.forEach(function (c) {
			var s = statsByClient[c.id] || { campaigns: 0, budget: 0, spent: 0, atRisk: 0, criticalAlerts: 0 };
			campaigns += s.campaigns;
			budget += s.budget;
			spent += s.spent;
			if (s.atRisk > 0) atRisk += 1; // clientes (no campañas) fuera de ritmo
			criticalAlerts += s.criticalAlerts;
		});
		$("#sumClients").text(clients.length);
		$("#sumCampaigns").text(campaigns);
		$("#sumBudget").text(money(budget));
		$("#sumSpent").text(money(spent));
		$("#sumAtRisk").text(atRisk);
		$("#sumAtRiskIcon").toggleClass("bg-success", atRisk === 0).toggleClass("bg-warning", atRisk > 0);
		$summary.removeClass("d-none");
		renderAlertBanner(criticalAlerts);
	}

	function renderAlertBanner(criticalAlerts) {
		if (!criticalAlerts) {
			$alertBanner.addClass("d-none");
			return;
		}
		$("#clientsAlertBannerText").text(
			criticalAlerts + (criticalAlerts === 1 ? " alerta crítica requiere" : " alertas críticas requieren") + " atención"
		);
		$alertBanner.removeClass("d-none");
	}

	function statusDots(stats) {
		var parts = [];
		if (stats.ok) parts.push('<span class="dot" style="background:#17c666;"></span>' + stats.ok + " en ritmo");
		if (stats.under) parts.push('<span class="dot" style="background:#f3b023;"></span>' + stats.under + " subgastando");
		if (stats.over) parts.push('<span class="dot" style="background:#ea4d4d;"></span>' + stats.over + " sobregastando");
		if (!parts.length) return "";
		return '<div class="status-dot-row text-muted d-flex flex-wrap gap-2 mt-2">' +
			parts.map(function (p) { return '<span class="d-inline-flex align-items-center">' + p + "</span>"; }).join("") +
			"</div>";
	}

	function renderClients(clients) {
		if (!clients.length) {
			showOnly($empty);
			return;
		}
		var html = clients.map(function (c, idx) {
			var accent = ACCENTS[idx % ACCENTS.length];
			var stats = statsByClient[c.id] || { campaigns: 0, budget: 0, spent: 0, last: null, ok: 0, under: 0, over: 0 };
			var desc = c.description
				? '<p class="text-muted fs-13 mb-0 text-ov">' + escapeHtml(c.description) + "</p>"
				: '<p class="text-muted fs-13 mb-0 fst-italic">Sin descripción</p>';
			return (
				'<div class="col-xl-4 col-lg-6 col-md-6">' +
				'<div class="card h-100">' +
				'<div class="card-body d-flex flex-column">' +
				'<div class="d-flex align-items-start">' +
				'<span class="' + accent + ' text-white rounded d-flex align-items-center justify-content-center me-3 fw-bold" style="width:44px;height:44px;flex:none;">' +
				escapeHtml(initials(c.name)) +
				"</span>" +
				'<div class="flex-grow-1 min-w-0">' +
				'<h5 class="mb-1 text-ov">' + escapeHtml(c.name) + "</h5>" +
				desc +
				"</div>" +
				'<div class="dropdown ms-2">' +
				'<a href="javascript:;" data-bs-toggle="dropdown"><i class="fa fa-ellipsis-v"></i></a>' +
				'<div class="dropdown-menu dropdown-menu-end">' +
				'<a href="javascript:;" class="dropdown-item edit-client-btn" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '" data-description="' + escapeHtml(c.description || "") + '"><i class="fa fa-pencil me-2"></i>Editar</a>' +
				'<a href="javascript:;" class="dropdown-item text-danger delete-client-btn" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '"><i class="fa fa-trash me-2"></i>Eliminar</a>' +
				"</div>" +
				"</div>" +
				"</div>" +
				'<div class="row text-center mt-4 mb-1">' +
				'<div class="col-4 border-end">' +
				'<h5 class="mb-0 font-w600">' + stats.campaigns + "</h5>" +
				'<span class="fs-12 text-muted">Campañas</span>' +
				"</div>" +
				'<div class="col-4 border-end">' +
				'<h5 class="mb-0 font-w600">' + money(stats.budget) + "</h5>" +
				'<span class="fs-12 text-muted">Presupuesto</span>' +
				"</div>" +
				'<div class="col-4">' +
				'<h5 class="mb-0 font-w600">' + money(stats.spent) + "</h5>" +
				'<span class="fs-12 text-muted">Gasto</span>' +
				"</div>" +
				"</div>" +
				statusDots(stats) +
				'<p class="fs-12 text-muted text-center mt-2 mb-0">Última auditoría: ' + fmtDate(stats.last) + "</p>" +
				'<a href="auditoria.html?client_id=' + c.id + '" class="btn btn-outline-primary btn-sm w-100 mt-3">Abrir auditoría <i class="fa fa-arrow-right ms-1"></i></a>' +
				"</div>" +
				"</div>" +
				"</div>"
			);
		}).join("");
		$grid.html(html);
		showOnly($grid);
	}

	function applyFilter() {
		var q = String($("#clientSearch").val() || "").trim().toLowerCase();
		var filtered = !q ? allClients : allClients.filter(function (c) {
			return (String(c.name || "") + " " + String(c.description || "")).toLowerCase().indexOf(q) !== -1;
		});
		if (!filtered.length && allClients.length) {
			$grid.html('<div class="col-12"><div class="card"><div class="card-body text-center py-5 text-muted">Ningún cliente coincide con la búsqueda.</div></div></div>');
			showOnly($grid);
			return;
		}
		renderClients(filtered);
	}

	// Igual que auditoria.js: trae el gasto real vía windsor-metrics y corre
	// el mismo motor de pacing (AuditLib.buildAuditRows) para que "Gasto
	// total", "En riesgo" y el banner de alertas usen el mismo cálculo que
	// la tabla de auditoría por cliente, no sólo el presupuesto configurado.
	function loadStats(clients) {
		statsByClient = {};
		if (!clients.length) return Promise.resolve();

		var windsor = (typeof WindsorClient !== "undefined")
			? WindsorClient.fetchMetrics({ raw: true }).catch(function () { return { dailyCampaignTotals: [] }; })
			: Promise.resolve({ dailyCampaignTotals: [] });

		return Promise.all([
			supabase.from("audit_records").select("id,client_id,campaign_name,presupuesto_total,fecha_inicio,fecha_fin,tipo_calendario,updated_at"),
			windsor,
		]).then(function (results) {
			var records = (results[0] && results[0].data) || [];
			var dailyCampaignTotals = (results[1] && results[1].dailyCampaignTotals) || [];
			var rows = (typeof AuditLib !== "undefined")
				? AuditLib.buildAuditRows(records, dailyCampaignTotals)
				: records.map(function (r) { return Object.assign({}, r, { metrics: { gastoActual: 0, pacingStatus: "OK" }, alerts: [] }); });

			rows.forEach(function (r) {
				if (!r.client_id) return;
				var s = statsByClient[r.client_id] || { campaigns: 0, budget: 0, spent: 0, last: null, ok: 0, under: 0, over: 0, atRisk: 0, criticalAlerts: 0 };
				s.campaigns += 1;
				s.budget += Number(r.presupuesto_total || 0);
				s.spent += r.metrics.gastoActual;
				if (!s.last || (r.updated_at && r.updated_at > s.last)) s.last = r.updated_at;
				if (r.metrics.pacingStatus === "OK") s.ok += 1;
				else if (r.metrics.pacingStatus === "SUBGASTANDO") { s.under += 1; s.atRisk += 1; }
				else { s.over += 1; s.atRisk += 1; }
				s.criticalAlerts += r.alerts.filter(function (a) { return a.severity === "danger"; }).length;
				statsByClient[r.client_id] = s;
			});
		});
	}

	function loadClients() {
		showOnly($loading);
		return supabase
			.from("audit_clients")
			.select("*")
			.order("created_at", { ascending: true })
			.then(function (res) {
				if (res.error) {
					// 42P01/PGRST205 = la tabla no existe todavía (migración pendiente)
					$migrationPending.removeClass("d-none");
					$summary.addClass("d-none");
					$loading.addClass("d-none");
					$empty.addClass("d-none");
					$grid.addClass("d-none");
					return;
				}
				allClients = res.data || [];
				return Promise.resolve(loadStats(allClients)).then(function () {
					renderSummary(allClients);
					applyFilter();
				});
			});
	}

	function openCreateModal() {
		$clientForm[0].reset();
		$("#clientId").val("");
		$("#clientModalTitle").text("Nuevo cliente");
		$clientFormError.addClass("d-none");
	}

	function openEditModal(id, name, description) {
		$("#clientId").val(id);
		$("#clientName").val(name);
		$("#clientDescription").val(description);
		$("#clientModalTitle").text("Editar cliente");
		$clientFormError.addClass("d-none");
		var modal = bootstrap.Modal.getOrCreateInstance(clientModalEl);
		modal.show();
	}

	function saveClient() {
		var id = $("#clientId").val();
		var name = $("#clientName").val().trim();
		var description = $("#clientDescription").val().trim();

		if (!name) {
			$clientFormError.text("El nombre del cliente es obligatorio.").removeClass("d-none");
			return;
		}

		var query;
		if (id) {
			query = supabase.from("audit_clients").update({ name: name, description: description || null }).eq("id", id);
		} else {
			query = supabase.auth.getUser().then(function (userRes) {
				var userId = userRes.data && userRes.data.user && userRes.data.user.id;
				return supabase.from("audit_clients").insert({ user_id: userId, name: name, description: description || null });
			});
		}

		Promise.resolve(query).then(function (res) {
			if (res.error) {
				$clientFormError.text("Error al guardar el cliente.").removeClass("d-none");
				return;
			}
			bootstrap.Modal.getOrCreateInstance(clientModalEl).hide();
			loadClients();
		});
	}

	function deleteClient() {
		if (!deleteTargetId) return;
		supabase.from("audit_clients").delete().eq("id", deleteTargetId).then(function () {
			bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
			deleteTargetId = null;
			loadClients();
		});
	}

	// --- Eventos ---
	$("#newClientBtn").on("click", openCreateModal);
	$("#retryLoadBtn").on("click", loadClients);
	$("#clientFormSubmit").on("click", saveClient);
	$("#confirmDeleteBtn").on("click", deleteClient);

	$(document).on("click", ".edit-client-btn", function () {
		openEditModal($(this).data("id"), $(this).data("name"), $(this).data("description"));
	});
	$(document).on("click", ".delete-client-btn", function () {
		deleteTargetId = $(this).data("id");
		$("#deleteClientName").text($(this).data("name"));
		bootstrap.Modal.getOrCreateInstance(deleteModalEl).show();
	});
	$("#logoutLink").on("click", function (e) {
		e.preventDefault();
		AuditClient.signOut();
	});

	// --- Arranque: sólo cargar si hay sesión ---
	AuditClient.getSession().then(function (session) {
		if (!session) {
			showOnly($authRequired);
			window.location.replace("page-login.html");
			return;
		}
		loadClients();
	});
})(jQuery);
