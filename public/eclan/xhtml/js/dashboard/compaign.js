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
		row.querySelector(".media-body > span").textContent = "Última actividad: " + c.lastDate;
		row.querySelector(".cl-btn").textContent = c.status;
		return row;
	}

	var selectedCurrency = null;

	// Nunca se oculta en silencio que hay más de una moneda: si currencies
	// trae más de una, se muestra un selector (en vez de mezclar montos de
	// MXN y USD en una sola lista).
	function renderCurrencyBar(data) {
		var $bar = $("#campaignCurrencyBar");
		var $select = $("#campaignCurrencySelect");
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

	function loadCampaigns() {
		var $container = $("#campaignList");
		if ($container.length === 0 || typeof WindsorClient === "undefined" || typeof AuditClient === "undefined") return;

		AuditClient.requireAuth().then(function (session) {
			if (!session) return; // ya redirigió a page-login.html

			WindsorClient.fetchMetrics({ datePreset: "last_90d", currency: selectedCurrency })
				.then(function (data) {
					selectedCurrency = data.currency;
					renderCurrencyBar(data);

					if (!data.campaigns || !data.campaigns.length) {
						$container.empty().append(
							$("<p>", { class: "text-muted p-4 mb-0", text: "No hay campañas en el rango consultado." })
						);
						return;
					}

					$container.empty();
					data.campaigns.forEach(function (c) { $container.append(renderCampaignRow(c, data.currency)); });

					// Peity escanea el DOM al llamarse; hay que reinicializar
					// después de inyectar los nuevos ".donut".
					$("#campaignList span.donut").peity("donut", { width: "80", height: "80" });
				})
				.catch(function (err) {
					console.error("windsor-metrics:", err);
					$container.empty().append(
						$("<div>", { class: "alert alert-danger m-3" }).text(
							"No se pudieron cargar las campañas de Windsor.ai" +
								(err && err.status ? " (HTTP " + err.status + ")" : "") +
								": " +
								(err && err.message ? err.message : "error desconocido")
						)
					);
				});
		});
	}

	jQuery(window).on("load", function () {
		$(document).on("change", "#campaignCurrencySelect", function () {
			selectedCurrency = $(this).val();
			loadCampaigns();
		});
		setTimeout(loadCampaigns, 300);
	});
})(jQuery);
