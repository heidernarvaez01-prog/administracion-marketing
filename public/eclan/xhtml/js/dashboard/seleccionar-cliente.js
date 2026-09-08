(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;

	var mode = new URLSearchParams(window.location.search).get("mode") || "brief";

	var MODES = {
		brief: {
			title: "Brief de marca",
			subtitle: "La historia de cada marca: quiénes son, qué venden y a quién le hablan. Alimenta las estrategias de IA.",
			target: "brief.html",
			table: "brand_briefs",
		},
		clusters: {
			title: "Clusters de proyección",
			subtitle: "Estrategias completas de marketing con IA para cada cliente, construidas desde su brief y los resultados reales de campaña.",
			target: "clusters.html",
			table: "cluster_runs",
		},
		weekly: {
			title: "Reporte semanal de rendimiento",
			subtitle: "Un resumen claro de cómo les fue a las campañas de cada cliente esta semana, entregado a su correo cada lunes.",
			target: "reporte-semanal.html",
			table: "weekly_reports",
		},
	};
	var cfg = MODES[mode] || MODES.brief;

	$("#pickerTitle").text(cfg.title);
	$("#pickerSubtitle").text(cfg.subtitle);

	var $loading = $("#clientsLoading");
	var $empty = $("#clientsEmpty");
	var $grid = $("#clientsGrid");
	var $migrationPending = $("#migrationPending");
	var $authRequired = $("#authRequired");

	function showOnly($el) {
		[$loading, $empty, $grid, $migrationPending, $authRequired].forEach(function ($x) { $x.addClass("d-none"); });
		if ($el) $el.removeClass("d-none");
	}

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	function initials(name) {
		var parts = String(name || "").trim().split(/\s+/).slice(0, 2);
		return parts.map(function (w) { return (w[0] || "").toUpperCase(); }).join("") || "·";
	}

	var ACCENTS = ["bg-primary", "bg-info", "bg-success", "bg-secondary", "bg-warning", "bg-danger"];

	function render(clients, badgeByClient) {
		if (!clients.length) { showOnly($empty); return; }
		$grid.html(clients.map(function (c, idx) {
			var badge = badgeByClient[c.id]
				? '<span class="badge bg-success-light text-success">' + escapeHtml(badgeByClient[c.id]) + "</span>"
				: '<span class="badge bg-light text-muted">Sin datos aún</span>';
			return (
				'<div class="col-xl-4 col-lg-6 col-md-6">' +
				'<a href="' + cfg.target + "?client_id=" + c.id + '" class="card text-decoration-none">' +
				'<div class="card-body">' +
				'<div class="d-flex align-items-center">' +
				'<span class="' + ACCENTS[idx % ACCENTS.length] + ' text-white rounded d-flex align-items-center justify-content-center me-3 fw-bold" style="width:44px;height:44px;flex:none;">' +
				escapeHtml(initials(c.name)) +
				"</span>" +
				'<div class="flex-grow-1 min-w-0">' +
				'<h5 class="mb-1 text-ov text-black">' + escapeHtml(c.name) + "</h5>" +
				badge +
				"</div>" +
				'<i class="fa fa-angle-right text-muted"></i>' +
				"</div></div></a></div>"
			);
		}).join(""));
		showOnly($grid);
	}

	function badgeFor(rows) {
		var map = {};
		if (mode === "brief") {
			rows.forEach(function (r) { map[r.client_id] = "Con brief"; });
		} else if (mode === "clusters") {
			rows.forEach(function (r) { map[r.client_id] = (map[r.client_id] ? parseInt(map[r.client_id]) + 1 : 1) + " corrida" + (map[r.client_id] ? "s" : ""); });
			// recompute simple counts (the loop above is a bit off for plural on first pass)
			var counts = {};
			rows.forEach(function (r) { counts[r.client_id] = (counts[r.client_id] || 0) + 1; });
			map = {};
			Object.keys(counts).forEach(function (k) { map[k] = counts[k] + " corrida" + (counts[k] === 1 ? "" : "s"); });
		} else if (mode === "weekly") {
			rows.forEach(function (r) {
				if (!map[r.client_id]) map[r.client_id] = "Último: " + r.week_end;
			});
		}
		return map;
	}

	function load() {
		showOnly($loading);
		supabase.from("audit_clients").select("id, name, description").order("created_at", { ascending: true })
			.then(function (res) {
				if (res.error) { showOnly($migrationPending); return; }
				var clients = res.data || [];
				var selectCol = mode === "weekly" ? "client_id, week_end" : "client_id";
				supabase.from(cfg.table).select(selectCol).then(function (badgeRes) {
					render(clients, badgeFor(badgeRes.data || []));
				});
			});
	}

	$("#retryLoadBtn").on("click", load);
	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	AuditClient.getSession().then(function (session) {
		if (!session) { showOnly($authRequired); window.location.replace("page-login.html"); return; }
		load();
	});
})(jQuery);
