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
	var isAdmin = false;
	// Paso 4: datos reales de Meta por cliente, vía client_period_totals.
	// metaStatsByClient[clientId][7|30] = [{currency, spend, impressions,
	// clicks, leads, messaging_conversations}, ...] — un elemento por moneda
	// si el cliente tiene cuentas en más de una (nunca se suman entre sí).
	var metaStatsByClient = {};
	// lastSyncByClient[clientId] = { lastSyncedAt, lastProbeAt } — el mayor
	// entre las cuentas del cliente (normalmente solo tiene una).
	var lastSyncByClient = {};
	var currentWindow = 30;

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

	// "hace X h" / "hace X días" — null si no hay fecha (caller decide el estado vacío).
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

	function fmtCount(n) {
		return Number(n || 0).toLocaleString("es-CO");
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

	function renderClients(clients) {
		if (!clients.length) {
			showOnly($empty);
			return;
		}
		var html = clients.map(function (c, idx) {
			var accent = ACCENTS[idx % ACCENTS.length];
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
				// El menú "⋮" (editar/eliminar cliente) es solo para admin —
				// client_accounts/client_members ya no se tocan desde esta
				// pantalla, se gestionan en "Clientes y Agencias".
				(isAdmin
					? '<div class="dropdown ms-2">' +
					'<a href="javascript:;" data-bs-toggle="dropdown"><i class="fa fa-ellipsis-v"></i></a>' +
					'<div class="dropdown-menu dropdown-menu-end">' +
					'<a href="javascript:;" class="dropdown-item edit-client-btn" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '" data-description="' + escapeHtml(c.description || "") + '"><i class="fa fa-pencil me-2"></i>Editar</a>' +
					'<a href="javascript:;" class="dropdown-item text-danger delete-client-btn" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '"><i class="fa fa-trash me-2"></i>Eliminar</a>' +
					"</div>" +
					"</div>"
					: "") +
				"</div>" +
				// Datos reales de Meta (Paso 4) — se llenan con
				// createElement/textContent justo después de insertar este
				// HTML en el DOM, nunca concatenados acá (ver buildMetaStatsBlock).
				'<div class="client-meta-stats" data-client-id="' + c.id + '"></div>' +
				// auditoria.html es solo-admin (Paso "menú por rol"); al resto
				// no le sirve el botón y la página lo redirige igual.
				(isAdmin
					? '<a href="auditoria.html?client_id=' + c.id + '" class="btn btn-outline-primary btn-sm w-100 mt-3">Abrir auditoría <i class="fa fa-arrow-right ms-1"></i></a>'
					: "") +
				"</div>" +
				"</div>" +
				"</div>"
			);
		}).join("");
		$grid.html(html);
		clients.forEach(function (c) {
			var el = $grid.find('.client-meta-stats[data-client-id="' + c.id + '"]')[0];
			if (el) el.appendChild(buildMetaStatsBlock(c.id));
		});
		showOnly($grid);
	}

	// Una celda "valor + etiqueta" del bloque de métricas reales.
	function metaCell(label, value) {
		var col = document.createElement("div");
		col.className = "col";
		var strong = document.createElement("div");
		strong.className = "fw-bold fs-14 text-ov";
		strong.textContent = value;
		var span = document.createElement("span");
		span.className = "fs-12 text-muted";
		span.textContent = label;
		col.appendChild(strong);
		col.appendChild(span);
		return col;
	}

	// Bloque de datos reales de Meta de un cliente, para la ventana actual
	// (currentWindow: 7 o 30 días) — un row de 5 métricas por moneda (nunca
	// se suman monedas distintas), más la línea de última sincronización.
	// Todo por createElement/textContent: nada de esto es HTML de confianza.
	function buildMetaStatsBlock(clientId) {
		var wrap = document.createElement("div");
		wrap.className = "mt-3";

		var rows = (metaStatsByClient[clientId] && metaStatsByClient[clientId][currentWindow]) || [];
		if (!rows.length) {
			var empty = document.createElement("p");
			empty.className = "fs-13 text-muted text-center mb-0";
			empty.textContent = "Sin datos de Meta todavía";
			wrap.appendChild(empty);
		} else {
			rows.forEach(function (row) {
				var grid = document.createElement("div");
				grid.className = "row text-center gx-1 mb-2";
				grid.appendChild(metaCell("Gasto", (row.currency || "") + " " + fmtCount(row.spend)));
				grid.appendChild(metaCell("Impresiones", fmtCount(row.impressions)));
				grid.appendChild(metaCell("Clics", fmtCount(row.clicks)));
				grid.appendChild(metaCell("Leads", row.leads == null ? "—" : fmtCount(row.leads)));
				grid.appendChild(metaCell("Conversac.", row.messaging_conversations == null ? "—" : fmtCount(row.messaging_conversations)));
				wrap.appendChild(grid);
			});
		}

		var sync = lastSyncByClient[clientId];
		var syncText = sync && sync.lastSyncedAt ? "Actualizado " + timeAgo(sync.lastSyncedAt)
			: sync && sync.lastProbeAt ? "Revisado " + timeAgo(sync.lastProbeAt)
			: null;
		if (syncText) {
			var syncLine = document.createElement("p");
			syncLine.className = "fs-12 text-muted text-center mt-1 mb-0";
			syncLine.textContent = syncText;
			wrap.appendChild(syncLine);
		}

		return wrap;
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

	// Paso 4: gasto/impresiones/clics/leads/conversaciones reales de Meta,
	// por cliente y por moneda, vía client_period_totals (agregado en SQL,
	// nunca sumando filas de meta_datos en el navegador). Los 2 rangos (7 y
	// 30 días) se piden una vez cada uno; cambiar el toggle solo re-pinta,
	// no vuelve a pedir nada. "Actualizado"/"Revisado" viene de
	// ad_accounts (last_synced_at/last_probe_at), no del RPC.
	function loadMetaStats(clients) {
		metaStatsByClient = {};
		lastSyncByClient = {};
		if (!clients.length) return Promise.resolve();

		return Promise.all([
			supabase.rpc("client_period_totals", { _days: 7 }),
			supabase.rpc("client_period_totals", { _days: 30 }),
			supabase.from("v_client_accounts").select("client_id,account_id"),
		]).then(function (results) {
			var res7 = results[0], res30 = results[1], resAccounts = results[2];

			function addRows(rows, windowDays) {
				(rows || []).forEach(function (row) {
					var s = metaStatsByClient[row.client_id] || { 7: [], 30: [] };
					s[windowDays].push(row);
					metaStatsByClient[row.client_id] = s;
				});
			}
			addRows(res7.data, 7);
			addRows(res30.data, 30);

			var accountRows = resAccounts.data || [];
			var clientByAccount = {};
			accountRows.forEach(function (r) { clientByAccount[r.account_id] = r.client_id; });
			var accountIds = Object.keys(clientByAccount);
			if (!accountIds.length) return;

			return supabase.from("ad_accounts").select("account_id,last_synced_at,last_probe_at").in("account_id", accountIds)
				.then(function (resAcc) {
					(resAcc.data || []).forEach(function (a) {
						var clientId = clientByAccount[a.account_id];
						if (!clientId) return;
						var cur = lastSyncByClient[clientId] || { lastSyncedAt: null, lastProbeAt: null };
						if (a.last_synced_at && (!cur.lastSyncedAt || a.last_synced_at > cur.lastSyncedAt)) cur.lastSyncedAt = a.last_synced_at;
						if (a.last_probe_at && (!cur.lastProbeAt || a.last_probe_at > cur.lastProbeAt)) cur.lastProbeAt = a.last_probe_at;
						lastSyncByClient[clientId] = cur;
					});
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
				return Promise.all([loadStats(allClients), loadMetaStats(allClients)]).then(function () {
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
	// Los 2 rangos ya están en memoria (loadMetaStats pidió 7 y 30 juntos) —
	// cambiar la ventana solo re-pinta, nunca vuelve a llamar al RPC.
	$("#clientsWindowToggle").on("click", ".window-btn", function () {
		currentWindow = Number($(this).data("days"));
		$("#clientsWindowToggle .window-btn").removeClass("active");
		$(this).addClass("active");
		applyFilter();
	});

	// --- Arranque: sólo cargar si hay sesión ---
	AuditClient.getSession().then(function (session) {
		if (!session) {
			showOnly($authRequired);
			window.location.replace("page-login.html");
			return;
		}
		// isAdmin decide, antes de pintar nada, si cada tarjeta lleva el menú
		// "⋮" (editar/eliminar) — role-ui.js no alcanza a tiempo el contenido
		// que esta página todavía no ha renderizado.
		AuditClient.getCurrentIdentity().then(function (identity) {
			isAdmin = !!(identity && identity.role === "admin");
			loadClients();
		});
	});
})(jQuery);
