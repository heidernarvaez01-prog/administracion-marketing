(function ($) {
	/* "use strict" */

	// ------------------------------------------------------------------
	// Lista de campañas real desde Windsor.ai (Edge Function
	// "windsor-metrics" -> campo "campaigns").
	//
	// Mapeo respecto al diseño original de compaign.html:
	//  - Donut %           -> CTR real (clicks/impressions)
	//  - "Today Spends" x2 -> Gasto real / Clics reales del rango
	//  - Estado On Going/Expired -> actividad en los últimos 3 días de
	//    datos disponibles en Windsor (no existe un campo de estado en
	//    los fields consultados)
	//  - URL de tracking (no existe en Windsor) -> se reemplaza por la
	//    plataforma (datasource) de la campaña
	// ------------------------------------------------------------------

	// Construye la fila con createElement/textContent: c.datasource/c.campaign/
	// c.lastDate vienen de Meta (vía meta_datos) y nunca deben insertarse como
	// HTML concatenado — un nombre de campaña con '<' rompería el markup o,
	// peor, inyectaría HTML/JS.
	function renderCampaignRow(c, currency) {
		var statusClass = c.status === "On Going" ? "bgl-primary text-primary" : "bgl-danger text-danger";
		var donutValue = Math.max(0, Math.min(100, c.ctr * 10)); // CTR real suele ser bajo (<10%); se escala x10 solo para que el donut visual no quede vacío
		var donutPeity = JSON.stringify({
			fill: ["rgb(82, 177, 65)", "rgba(236, 236, 236, 1)"],
			innerRadius: 32,
			radius: 10,
		});

		var row = document.createElement("div");
		row.className = "compaign-row align-items-center p-sm-4 p-3 row sp16 mx-0 mb-2";
		row.innerHTML =
			'<div class="my-2 col-xl-4 col-xxl-6 col-lg-6 col-md-8 col-sm-12">' +
			'<div class="media align-items-center">' +
			'<div class="d-inline-block position-relative donut-chart-sale me-4">' +
			"<span class=\"donut\" data-peity='" + donutPeity + "'></span>" +
			"<small></small>" +
			"</div>" +
			'<div class="media-body">' +
			'<p class="text-primary mb-1"></p>' +
			'<h3 class="fs-20"><a class="text-black" href="analytics.html"></a></h3>' +
			'<span class="fs-14 ms-1"></span>' +
			"</div>" +
			"</div>" +
			"</div>" +
			'<div class="col-xl-2 col-xxl-6 col-lg-6 col-md-4 col-sm-8 px-3">' +
			'<div class="row align-items-center my-2">' +
			'<div class="col-6"><h3 class="fs-20 text-black">' + WindsorClient.money(c.spend, currency) + '</h3><span class="fs-14">Gasto</span></div>' +
			'<div class="col-6"><h3 class="fs-20 text-black">' + WindsorClient.compact(c.clicks) + '</h3><span class="fs-14">Clics</span></div>' +
			"</div>" +
			"</div>" +
			'<div class="col-xl-2 col-xxl-4 col-lg-4 col-md-6 text-center my-2 col-sm-4">' +
			'<span class="btn btn-outline-dark p-3 text-ov">' + WindsorClient.compact(c.impressions) + " impresiones</span>" +
			"</div>" +
			'<div class="col-xl-4 col-xxl-8 col-lg-8 col-md-6 text-start text-md-end my-2">' +
			'<span class="btn ' + statusClass + ' cl-btn"></span>' +
			"</div>";

		row.querySelector(".donut-chart-sale .donut").textContent = donutValue.toFixed(0) + "/100";
		row.querySelector(".donut-chart-sale small").textContent = c.ctr.toFixed(2) + "% CTR";
		row.querySelector(".media-body p").textContent = c.datasource;
		row.querySelector(".media-body h3 a").textContent = c.campaign;
		var extra = [];
		if (c.clientName) extra.push(c.clientName);
		if (c.leads) extra.push(WindsorClient.compact(c.leads) + " leads");
		if (c.conversations) extra.push(WindsorClient.compact(c.conversations) + " conversaciones");
		extra.push("Última actividad: " + WindsorClient.shortDate(c.lastDate));
		row.querySelector(".media-body > span").textContent = extra.join(" · ");
		row.querySelector(".cl-btn").textContent = c.status === "On Going" ? "Activa" : "Sin gasto reciente";
		return row;
	}

	var CLIENT_KEY = "apache360.selectedClientId";
	var selectedCurrency = null;
	var currentPreset = "last_90d";
	var statusFilter = "all";
	var sortKey = "spend";
	var selectedClientId = "";
	try { selectedClientId = localStorage.getItem(CLIENT_KEY) || ""; } catch (e) {}
	var clientNames = {};
	var lastData = null;

	function renderCurrencyBar(data) {
		var $bar = $("#campaignCurrencyBar");
		var $select = $("#campaignCurrencySelect");
		if (!data.currencies || data.currencies.length < 2) { $bar.addClass("d-none"); return; }
		$select.empty();
		data.currencies.forEach(function (cur) {
			$select.append($("<option>", { value: cur, text: cur, selected: cur === data.currency }));
		});
		$bar.removeClass("d-none");
	}

	function loadClients() {
		return AuditClient.supabase.from("audit_clients").select("id,name").order("name").then(function (res) {
			var list = res.data || [];
			list.forEach(function (c) { clientNames[c.id] = c.name; });
			if (selectedClientId && !clientNames[selectedClientId]) selectedClientId = "";
			var $sel = $("#campaignClientSelect");
			if (list.length < 2) { $sel.addClass("d-none"); return; }
			$sel.empty().append($("<option>", { value: "", text: "Todos los clientes" }));
			list.forEach(function (c) { $sel.append($("<option>", { value: c.id, text: c.name })); });
			$sel.val(selectedClientId).removeClass("d-none");
		});
	}

	function renderList() {
		var $container = $("#campaignList");
		var data = lastData;
		if (!data) return;
		var rows = (data.campaigns || []).map(function (c) {
			return $.extend({}, c, { clientName: selectedClientId ? "" : clientNames[c.clientId] || "" });
		}).filter(function (c) { return statusFilter === "all" || c.status === statusFilter; });
		rows.sort(function (a, b) {
			if (sortKey === "lastDate") return a.lastDate < b.lastDate ? 1 : -1;
			return (b[sortKey] || 0) - (a[sortKey] || 0);
		});
		$container.empty();
		if (!rows.length) {
			$container.append($("<p>", { class: "text-muted p-4 mb-0", text: "No hay campañas con este filtro en el período." }));
			return;
		}
		rows.forEach(function (c) { $container.append(renderCampaignRow(c, data.currency)); });
		$("#campaignList span.donut").peity("donut", { width: "80", height: "80" });
	}

	function loadCampaigns() {
		var $container = $("#campaignList");
		if ($container.length === 0 || typeof WindsorClient === "undefined" || typeof AuditClient === "undefined") return;
		$("#campaignSubtitle").text("Cargando campañas…");

		WindsorClient.fetchMetrics({ datePreset: currentPreset, currency: selectedCurrency, clientId: selectedClientId || undefined })
			.then(function (data) {
				lastData = data;
				selectedCurrency = data.currency;
				renderCurrencyBar(data);
				var labels = (data.clickSummary && data.clickSummary.labels) || [];
				var rango = labels.length ? WindsorClient.longDate(labels[0]) + " – " + WindsorClient.longDate(labels[labels.length - 1]) : "sin datos en el período";
				$("#campaignSubtitle").text((data.campaigns || []).length + " campañas · " + rango);
				var g = new Date(data.generatedAt || Date.now());
				$("#campaignHeaderTime").text(g.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
				$("#campaignHeaderDate").text("Actualizado " + g.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }));
				renderList();
			})
			.catch(function (err) {
				console.error("windsor-metrics:", err);
				$("#campaignSubtitle").text("No se pudieron cargar las campañas");
				$container.empty().append(
					$("<div>", { class: "alert alert-danger m-3" }).text(
						"No se pudieron cargar las campañas" + (err && err.status ? " (HTTP " + err.status + ")" : "") + ": " + (err && err.message ? err.message : "error desconocido")
					)
				);
			});
	}

	function setActive(groupSel, attr, value) {
		$(groupSel + " button").removeClass("btn-primary").addClass("bg-white");
		$(groupSel + " button[data-" + attr + '="' + value + '"]').removeClass("bg-white").addClass("btn-primary");
	}

	$(document).on("change", "#campaignCurrencySelect", function () { selectedCurrency = $(this).val(); loadCampaigns(); });
	$(document).on("change", "#campaignClientSelect", function () {
		selectedClientId = $(this).val();
		try { localStorage.setItem(CLIENT_KEY, selectedClientId); } catch (e) {}
		selectedCurrency = null;
		loadCampaigns();
	});
	$(document).on("click", "#campaignRangeGroup button", function () {
		currentPreset = $(this).data("preset"); setActive("#campaignRangeGroup", "preset", currentPreset); loadCampaigns();
	});
	$(document).on("click", "#campaignStatusGroup button", function () {
		statusFilter = $(this).data("status"); setActive("#campaignStatusGroup", "status", statusFilter); renderList();
	});
	$(document).on("change", "#campaignSortSelect", function () { sortKey = $(this).val(); renderList(); });
	$(document).on("click", "#campaignReload", function () { loadCampaigns(); });

	if (typeof AuditClient !== "undefined") {
		AuditClient.requireAuth().then(function (session) {
			if (!session) return;
			loadClients().then(loadCampaigns, loadCampaigns);
		});
	}
})(jQuery);
