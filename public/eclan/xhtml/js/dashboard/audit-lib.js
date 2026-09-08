/**
 * Motor de pacing/presupuesto + alertas, portado a JS plano desde
 * Ad-Audit-Platform (src/lib/business-days.ts, audit-calculations.ts,
 * audit-helpers.ts, supabase/functions/_shared/alert-engine.ts).
 *
 * Se usa contra el campo "dailyCampaignTotals" de windsor-metrics?raw=1
 * (clicks/spend/impressions por día y campaña) en vez de la tabla
 * "meta_datos" que usaba la versión original — así el motor de
 * auditoría funciona sin desplegar sync-meta-datos ni un cron nuevo.
 *
 * Alertas portadas: OVERSPEND_50, NOT_SPENDING, ENDING_SOON, COST_SPIKE,
 * BUDGET_EARLY_DEPLETION. Se dejan afuera CREATIVE_FATIGUE y
 * BUDGET_MISMATCH porque necesitan "frequency"/"daily_budget", campos
 * que windsor-metrics no pide hoy (ver plataformas.ts / WINDSOR_FIELDS).
 */
(function (window) {
	"use strict";

	// ------------------------------------------------------------------
	// business-days.ts
	// ------------------------------------------------------------------
	function isBusinessDay(date, labDays) {
		var day = date.getDay(); // 0=Dom, 6=Sáb
		if (labDays === "mon_fri") return day >= 1 && day <= 5;
		if (labDays === "mon_sat") return day >= 1 && day <= 6;
		return true; // "all"
	}

	function eachDay(start, end) {
		var days = [];
		var d = new Date(start.getTime());
		d.setHours(0, 0, 0, 0);
		var last = new Date(end.getTime());
		last.setHours(0, 0, 0, 0);
		while (d.getTime() <= last.getTime()) {
			days.push(new Date(d.getTime()));
			d.setDate(d.getDate() + 1);
		}
		return days;
	}

	function parseISODate(iso) {
		// "YYYY-MM-DD" -> Date a medianoche LOCAL (evita el corrimiento de
		// un día que da `new Date("YYYY-MM-DD")` al interpretarlo como UTC).
		var parts = String(iso).split("-").map(Number);
		return new Date(parts[0], parts[1] - 1, parts[2]);
	}

	function countBusinessDays(startIso, endIso, labDays) {
		var start = parseISODate(startIso);
		var end = parseISODate(endIso);
		if (start > end) return 0;
		return eachDay(start, end).filter(function (d) { return isBusinessDay(d, labDays); }).length;
	}

	function countRemainingBusinessDays(today, endIso, labDays) {
		var end = parseISODate(endIso);
		if (today > end) return 0;
		return eachDay(today, end).filter(function (d) { return isBusinessDay(d, labDays); }).length;
	}

	function countElapsedBusinessDays(startIso, today, labDays) {
		var start = parseISODate(startIso);
		if (today < start) return 0;
		return eachDay(start, today).filter(function (d) { return isBusinessDay(d, labDays); }).length;
	}

	function toLabDays(tipo) {
		if (tipo === "lun_vie") return "mon_fri";
		if (tipo === "lun_sab") return "mon_sat";
		return "all"; // "corridos"
	}

	// ------------------------------------------------------------------
	// audit-calculations.ts
	// ------------------------------------------------------------------
	function calculateAuditMetrics(presupuestoTotal, fechaInicio, fechaFin, tipoCalendario, gastoActual) {
		var today = new Date();
		today.setHours(0, 0, 0, 0);
		var labDays = toLabDays(tipoCalendario);

		var diasTotales = countBusinessDays(fechaInicio, fechaFin, labDays);
		var diasTranscurridos = countElapsedBusinessDays(fechaInicio, today, labDays);
		var diasRestantes = countRemainingBusinessDays(today, fechaFin, labDays);

		var porcentajeGastado = presupuestoTotal > 0 ? (gastoActual / presupuestoTotal) * 100 : 0;
		var presupuestoRestante = presupuestoTotal - gastoActual;
		var presupuestoDiarioIdeal = diasRestantes > 0 ? presupuestoRestante / diasRestantes : 0;

		var gastoEsperado = diasTotales > 0 ? (diasTranscurridos / diasTotales) * presupuestoTotal : 0;
		var gastoDiarioActual = diasTranscurridos > 0 ? gastoActual / diasTranscurridos : 0;
		var porcentajeTiempo = diasTotales > 0 ? (diasTranscurridos / diasTotales) * 100 : 0;

		var pacingPct = gastoEsperado > 0 ? ((gastoActual - gastoEsperado) / gastoEsperado) * 100 : 0;
		var pacingStatus = "OK";
		if (pacingPct > 10) pacingStatus = "SOBREGASTANDO";
		else if (pacingPct < -10) pacingStatus = "SUBGASTANDO";

		return {
			diasTotales: diasTotales,
			diasTranscurridos: diasTranscurridos,
			diasRestantes: diasRestantes,
			gastoActual: gastoActual,
			porcentajeGastado: porcentajeGastado,
			presupuestoRestante: presupuestoRestante,
			presupuestoDiarioIdeal: presupuestoDiarioIdeal,
			gastoEsperado: gastoEsperado,
			gastoDiarioActual: gastoDiarioActual,
			porcentajeTiempo: porcentajeTiempo,
			pacingStatus: pacingStatus,
			pacingPct: pacingPct,
		};
	}

	function getTipoCalendarioLabel(tipo) {
		if (tipo === "lun_vie") return "Lunes a viernes";
		if (tipo === "lun_sab") return "Lunes a sábado";
		return "Todos los días";
	}

	// ------------------------------------------------------------------
	// audit-helpers.ts
	// ------------------------------------------------------------------
	function pad2(n) { return String(n).padStart(2, "0"); }

	function getConsolidationCutoff() {
		var today = new Date();
		today.setHours(0, 0, 0, 0);
		var cutoff = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
		return cutoff.getFullYear() + "-" + pad2(cutoff.getMonth() + 1) + "-" + pad2(cutoff.getDate());
	}

	/**
	 * @param {Array} records filas de audit_records (campaign_name,
	 *   presupuesto_total, fecha_inicio, fecha_fin, tipo_calendario)
	 * @param {Array} dailyCampaignTotals el campo homónimo de
	 *   windsor-metrics?raw=1 ({date, campaign, clicks, spend, impressions})
	 */
	function buildAuditRows(records, dailyCampaignTotals) {
		var cutoff = getConsolidationCutoff();
		dailyCampaignTotals = dailyCampaignTotals || [];

		return records.map(function (rec) {
			var effectiveEnd = rec.fecha_fin < cutoff ? rec.fecha_fin : cutoff;
			var campaignRows = dailyCampaignTotals.filter(function (r) {
				return r.campaign === rec.campaign_name && r.date >= rec.fecha_inicio && r.date <= effectiveEnd;
			});
			var cost = campaignRows.reduce(function (s, r) { return s + (isNaN(r.spend) ? 0 : r.spend); }, 0);
			var metrics = calculateAuditMetrics(Number(rec.presupuesto_total), rec.fecha_inicio, rec.fecha_fin, rec.tipo_calendario, cost);
			var alerts = generateAlerts(metrics, campaignRows);
			return Object.assign({}, rec, {
				presupuesto_total: Number(rec.presupuesto_total),
				metrics: metrics,
				alerts: alerts,
				campaignRows: campaignRows,
			});
		});
	}

	// ------------------------------------------------------------------
	// alert-engine.ts (5 de las 7 reglas — ver comentario arriba)
	// ------------------------------------------------------------------
	function isoDaysAgo(days) {
		var d = new Date();
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - days);
		return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
	}

	function sumWindow(rows, from, to, pick) {
		return rows
			.filter(function (r) { return r.date >= from && r.date <= to; })
			.reduce(function (s, r) { var v = pick(r); return s + (isNaN(v) ? 0 : v); }, 0);
	}

	var DEFAULT_THRESHOLDS = {
		overspendPct: 50,
		notSpendingWindowDays: 3,
		endingSoonPctThreshold: 90,
		costSpikePct: 65,
		earlyDepletionDays: 2,
	};

	function generateAlerts(metrics, campaignRows, thresholds) {
		var t = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});
		var alerts = [];
		var inFlight = metrics.diasRestantes > 0 && metrics.diasTranscurridos > 0;
		var lastConsolidated = isoDaysAgo(2);

		// 1. Sobregasto X%+ sobre lo esperado
		var overspendMultiplier = 1 + t.overspendPct / 100;
		if (metrics.gastoEsperado > 0 && metrics.gastoActual >= metrics.gastoEsperado * overspendMultiplier) {
			var pctAbove = (((metrics.gastoActual - metrics.gastoEsperado) / metrics.gastoEsperado) * 100).toFixed(0);
			alerts.push({
				type: "OVERSPEND_50", severity: "danger", icon: "🔴",
				message: "Gasto " + pctAbove + "% por encima de lo esperado a la fecha ($" + metrics.gastoActual.toFixed(2) + " vs $" + metrics.gastoEsperado.toFixed(2) + " esperado). Limita el gasto diario a $" + metrics.presupuestoDiarioIdeal.toFixed(2) + " para recuperar el ritmo.",
			});
		}

		// 2. Campaña sin gasto reciente
		if (inFlight && metrics.diasTranscurridos >= t.notSpendingWindowDays) {
			var recentSpend = sumWindow(campaignRows, isoDaysAgo(t.notSpendingWindowDays + 1), lastConsolidated, function (r) { return r.spend; });
			if (recentSpend === 0) {
				alerts.push({
					type: "NOT_SPENDING", severity: "danger", icon: "⛔",
					message: "Sin gasto registrado en los últimos " + t.notSpendingWindowDays + " días consolidados. La campaña puede estar pausada, rechazada o topada por presupuesto — revisa la entrega ahora.",
				});
			}
		}

		// 3. Campaña por finalizar
		if (metrics.porcentajeTiempo >= t.endingSoonPctThreshold && metrics.diasRestantes > 0) {
			alerts.push({
				type: "ENDING_SOON", severity: "info", icon: "🏁",
				message: "La campaña va en " + metrics.porcentajeTiempo.toFixed(0) + "% de su cronograma (quedan " + metrics.diasRestantes + " día" + (metrics.diasRestantes === 1 ? "" : "s") + "). Saldo restante: $" + metrics.presupuestoRestante.toFixed(2) + " — planea la renovación o el cierre.",
			});
		}

		// 4. Pico de costo (CPC/CPM) vs. semana anterior
		if (inFlight) {
			var recentFrom = isoDaysAgo(4), prevFrom = isoDaysAgo(11), prevTo = isoDaysAgo(5);
			var spikeMultiplier = 1 + t.costSpikePct / 100;
			var rCost = sumWindow(campaignRows, recentFrom, lastConsolidated, function (r) { return r.spend; });
			var rClicks = sumWindow(campaignRows, recentFrom, lastConsolidated, function (r) { return r.clicks; });
			var rImpr = sumWindow(campaignRows, recentFrom, lastConsolidated, function (r) { return r.impressions; });
			var pCost = sumWindow(campaignRows, prevFrom, prevTo, function (r) { return r.spend; });
			var pClicks = sumWindow(campaignRows, prevFrom, prevTo, function (r) { return r.clicks; });
			var pImpr = sumWindow(campaignRows, prevFrom, prevTo, function (r) { return r.impressions; });
			var rCpc = rClicks > 0 ? rCost / rClicks : 0;
			var pCpc = pClicks > 0 ? pCost / pClicks : 0;
			var rCpm = rImpr > 0 ? (rCost / rImpr) * 1000 : 0;
			var pCpm = pImpr > 0 ? (pCost / pImpr) * 1000 : 0;

			if (pCpc > 0 && rCpc > pCpc * spikeMultiplier) {
				var pctCpc = (((rCpc - pCpc) / pCpc) * 100).toFixed(0);
				alerts.push({ type: "COST_SPIKE", severity: "danger", icon: "📈", message: "El CPC subió " + pctCpc + "% vs. la semana anterior ($" + rCpc.toFixed(2) + " vs $" + pCpc.toFixed(2) + "). Revisa segmentación, creativos o cambios de subasta." });
			} else if (pCpm > 0 && rCpm > pCpm * spikeMultiplier) {
				var pctCpm = (((rCpm - pCpm) / pCpm) * 100).toFixed(0);
				alerts.push({ type: "COST_SPIKE", severity: "danger", icon: "📈", message: "El CPM subió " + pctCpm + "% vs. la semana anterior ($" + rCpm.toFixed(2) + " vs $" + pCpm.toFixed(2) + "). Revisa segmentación, creativos o cambios de subasta." });
			}
		}

		// 5. Presupuesto se agota antes de tiempo
		if (inFlight && metrics.gastoDiarioActual > 0 && metrics.presupuestoRestante > 0) {
			var daysUntilDepletion = metrics.presupuestoRestante / metrics.gastoDiarioActual;
			var daysEarly = metrics.diasRestantes - daysUntilDepletion;
			if (daysEarly >= t.earlyDepletionDays) {
				alerts.push({
					type: "BUDGET_EARLY_DEPLETION", severity: "warning", icon: "⏳",
					message: "Al ritmo actual ($" + metrics.gastoDiarioActual.toFixed(2) + "/día), el presupuesto se agota ~" + Math.round(daysEarly) + " días antes de la fecha de fin. Reduce el gasto diario a $" + metrics.presupuestoDiarioIdeal.toFixed(2) + " para que alcance todo el período.",
				});
			}
		}

		return alerts;
	}

	window.AuditLib = {
		calculateAuditMetrics: calculateAuditMetrics,
		getTipoCalendarioLabel: getTipoCalendarioLabel,
		getConsolidationCutoff: getConsolidationCutoff,
		buildAuditRows: buildAuditRows,
		generateAlerts: generateAlerts,
	};
})(window);
