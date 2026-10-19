(function () {
	"use strict";
	var FN = "https://szdivobcbdkiszgrizic.supabase.co/functions/v1/share-dashboard";
	var KEY = "sb_publishable_ldumgPigulWT8adpCHpa_Q_dLVy4EC-";
	var token = new URLSearchParams(location.search).get("t") || "";
	var $ = function (id) { return document.getElementById(id); };
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
	function n(v) { return Number(v || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 }); }
	function m(v, cur) { return (cur || "") + " " + Number(v || 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
	function pct(a, b) { return b ? (a / b * 100).toFixed(2) + "%" : "—"; }

	function table(rows, cols) {
		if (!rows.length) return '<p class="text-muted mb-0">Sin datos en este período.</p>';
		return '<table class="table table-sm mb-0"><thead><tr>' + cols.map(function (c) { return "<th" + (c.r ? ' class="text-end"' : "") + ">" + c.h + "</th>"; }).join("") +
			"</tr></thead><tbody>" + rows.map(function (r) {
				return "<tr>" + cols.map(function (c) { var v = c.f(r); return "<td" + (c.r ? ' class="text-end text-nowrap"' : ' class="text-ov" title="' + esc(v) + '"') + ">" + esc(v) + "</td>"; }).join("") + "</tr>";
			}).join("") + "</tbody></table>";
	}
	var base = [
		{ h: "Gasto", r: 1, f: function (r) { return m(r.spend, r.currency); } },
		{ h: "Clics", r: 1, f: function (r) { return n(r.clicks); } },
		{ h: "CTR", r: 1, f: function (r) { return pct(r.clicks, r.impressions); } },
	];
	function withName(h, f, extra) { return [{ h: h, f: f }].concat(base, extra || []); }
	var conv = [{ h: "Conversaciones", r: 1, f: function (r) { return n(r.messaging_conversations); } }];
	function bySpend(a) { return a.slice().sort(function (x, y) { return y.spend - x.spend; }); }

	function render(d) {
		$("clientName").textContent = d.client;
		document.title = "Apache 360 · " + d.client;
		var days = d.daily.map(function (r) { return r.fecha; }).sort();
		$("rangeLabel").textContent = days.length ? "Del " + days[0] + " al " + days[days.length - 1] : "";
		var cur = {}, t = { impressions: 0, clicks: 0, leads: 0, conv: 0 };
		d.daily.forEach(function (r) {
			cur[r.currency || ""] = (cur[r.currency || ""] || 0) + Number(r.spend || 0);
			t.impressions += +r.impressions || 0; t.clicks += +r.clicks || 0; t.leads += +r.leads || 0; t.conv += +r.messaging_conversations || 0;
		});
		var k = Object.keys(cur).map(function (c) { return ["Gasto " + c, m(cur[c], c)]; })
			.concat([["Impresiones", n(t.impressions)], ["Clics", n(t.clicks)], ["CTR", pct(t.clicks, t.impressions)], ["Leads", n(t.leads)], ["Conversaciones", n(t.conv)]]);
		$("kpis").innerHTML = k.map(function (x) { return '<div class="col-6 col-md-4 col-xl-2"><div class="card kpi"><div class="card-body p-3"><p>' + esc(x[0]) + "</p><h3>" + esc(x[1]) + "</h3></div></div></div>"; }).join("");
		$("campaigns").innerHTML = table(bySpend(d.campaigns), withName("Campaña", function (r) { return r.campaign_name; }, conv));
		$("ads").innerHTML = table(bySpend(d.ads), withName("Anuncio", function (r) { return r.ad_name; }, conv));
		$("platform").innerHTML = table(bySpend(d.platform), withName("Plataforma", function (r) { return r.dim1; }));
		$("gender").innerHTML = table(bySpend(d.gender), withName("Género", function (r) { return ({ female: "Mujeres", male: "Hombres", unknown: "Sin dato" })[r.dim1] || r.dim1; }));
		$("age").innerHTML = table(d.age.slice().sort(function (a, b) { return String(a.dim1).localeCompare(b.dim1); }), withName("Edad", function (r) { return r.dim1; }));
		$("region").innerHTML = table(bySpend(d.region), withName("Región", function (r) { return r.dim2 || r.dim1; }));
		$("content").classList.remove("d-none");
	}

	function load(days) {
		document.querySelectorAll("[data-days]").forEach(function (b) { b.className = "btn btn-sm " + (+b.dataset.days === days ? "btn-primary" : "btn-outline-primary"); });
		fetch(FN + "?token=" + encodeURIComponent(token) + "&days=" + days, { headers: { apikey: KEY } })
			.then(function (r) { return r.json(); })
			.then(function (d) {
				if (d.error) throw new Error(d.error);
				$("error").classList.add("d-none"); render(d);
			})
			.catch(function (e) {
				$("clientName").textContent = "";
				$("content").classList.add("d-none");
				$("error").textContent = e.message || "No se pudieron cargar los datos";
				$("error").classList.remove("d-none");
			});
	}
	document.querySelectorAll("[data-days]").forEach(function (b) { b.addEventListener("click", function () { load(+b.dataset.days); }); });
	load(30);
})();
