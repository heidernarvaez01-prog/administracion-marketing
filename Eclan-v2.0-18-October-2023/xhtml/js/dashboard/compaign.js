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

	function renderCampaignRow(c) {
		var statusClass = c.status === "On Going" ? "bgl-primary text-primary" : "bgl-danger text-danger";
		var donutValue = Math.max(0, Math.min(100, c.ctr * 10)); // CTR real suele ser bajo (<10%); se escala x10 solo para que el donut visual no quede vacío
		var donutPeity = JSON.stringify({
			fill: ["rgb(82, 177, 65)", "rgba(236, 236, 236, 1)"],
			innerRadius: 32,
			radius: 10,
		});

		return (
			'<div class="compaign-row align-items-center p-sm-4 p-3 row sp16 mx-0 mb-2">' +
			'<div class="my-2 col-xl-4 col-xxl-6 col-lg-6 col-md-8 col-sm-12">' +
			'<div class="media align-items-center">' +
			'<div class="d-inline-block position-relative donut-chart-sale me-4">' +
			"<span class=\"donut\" data-peity='" + donutPeity + "'>" + donutValue.toFixed(0) + "/100</span>" +
			"<small>" + c.ctr.toFixed(2) + "% CTR</small>" +
			"</div>" +
			'<div class="media-body">' +
			'<p class="text-primary mb-1">' + c.datasource + "</p>" +
			'<h3 class="fs-20"><a class="text-black" href="analytics.html">' + c.campaign + "</a></h3>" +
			'<span class="fs-14 ms-1">Última actividad: ' + c.lastDate + "</span>" +
			"</div>" +
			"</div>" +
			"</div>" +
			'<div class="col-xl-2 col-xxl-6 col-lg-6 col-md-4 col-sm-8 px-3">' +
			'<div class="row align-items-center my-2">' +
			'<div class="col-6"><h3 class="fs-20 text-black">' + WindsorClient.money(c.spend) + '</h3><span class="fs-14">Gasto</span></div>' +
			'<div class="col-6"><h3 class="fs-20 text-black">' + WindsorClient.compact(c.clicks) + '</h3><span class="fs-14">Clics</span></div>' +
			"</div>" +
			"</div>" +
			'<div class="col-xl-2 col-xxl-4 col-lg-4 col-md-6 text-center my-2 col-sm-4">' +
			'<span class="btn btn-outline-dark p-3 text-ov">' + WindsorClient.compact(c.impressions) + " impresiones</span>" +
			"</div>" +
			'<div class="col-xl-4 col-xxl-8 col-lg-8 col-md-6 text-start text-md-end my-2">' +
			'<span class="btn ' + statusClass + ' cl-btn">' + c.status + "</span>" +
			"</div>" +
			"</div>"
		);
	}

	function loadCampaigns() {
		var $container = $("#campaignList");
		if ($container.length === 0 || typeof WindsorClient === "undefined") return;

		WindsorClient.fetchMetrics({ datePreset: "last_90d" })
			.then(function (data) {
				if (!data.campaigns || !data.campaigns.length) {
					$container.html('<p class="text-muted p-4 mb-0">No hay campañas en el rango consultado.</p>');
					return;
				}

				var html = data.campaigns.map(renderCampaignRow).join("");
				$container.html(html);

				// Peity escanea el DOM al llamarse; hay que reinicializar
				// después de inyectar los nuevos ".donut".
				$("#campaignList span.donut").peity("donut", { width: "80", height: "80" });
			})
			.catch(function (err) {
				console.error("windsor-metrics:", err);
				$container.html(
					'<div class="alert alert-danger m-3">No se pudieron cargar las campañas de Windsor.ai' +
						(err && err.status ? " (HTTP " + err.status + ")" : "") +
						": " +
						(err && err.message ? err.message : "error desconocido") +
						"</div>"
				);
			});
	}

	jQuery(window).on("load", function () {
		setTimeout(loadCampaigns, 300);
	});
})(jQuery);
