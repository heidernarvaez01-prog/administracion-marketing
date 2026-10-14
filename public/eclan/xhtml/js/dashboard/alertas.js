(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined" || typeof AuditLib === "undefined") return;
	var supabase = AuditClient.supabase;

	var RULE_TYPES = ["OVERSPEND_50", "NOT_SPENDING", "ENDING_SOON", "COST_SPIKE", "BUDGET_EARLY_DEPLETION"];
	var RULE_INFO = {
		OVERSPEND_50: { label: "Sobregasto", desc: "Gasto N%+ por encima de lo esperado a la fecha.", unit: "% sobre lo esperado", field: "overspendPct", def: 50 },
		NOT_SPENDING: { label: "Campaña sin gasto", desc: "Una campaña activa dejó de entregar (sin gasto en N días consolidados).", unit: "días consolidados", field: "notSpendingWindowDays", def: 3 },
		ENDING_SOON: { label: "Campaña por finalizar", desc: "La campaña va en N%+ de su cronograma — planea renovación/cierre.", unit: "% del cronograma", field: "endingSoonPctThreshold", def: 90 },
		COST_SPIKE: { label: "Pico de costo", desc: "El CPC o CPM subió más de N% vs. la semana anterior.", unit: "% de aumento en CPC/CPM", field: "costSpikePct", def: 65 },
		BUDGET_EARLY_DEPLETION: { label: "Presupuesto se agota antes de tiempo", desc: "Al ritmo actual el presupuesto se agota N+ días antes de la fecha de fin.", unit: "días de anticipación", field: "earlyDepletionDays", def: 2 },
	};

	var $loading = $("#alertsLoading");
	var $content = $("#alertsContent");
	var $migrationPending = $("#migrationPending");
	var $authRequired = $("#authRequired");

	function showOnly($el) {
		[$loading, $content, $migrationPending, $authRequired].forEach(function ($x) { $x.addClass("d-none"); });
		if ($el) $el.removeClass("d-none");
	}

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	var rules = [];
	var channels = [];
	var settings = { enabled: true, only_critical: false, notify_frequency: "daily" };

	// --- Canales de notificación (puerto de src/hooks/useNotificationChannels.ts) ---
	function getChannel(type) {
		var found = channels.filter(function (c) { return c.channel_type === type; })[0];
		return found || { channel_type: type, config: {}, enabled: false };
	}

	function loadChannels() {
		return supabase.auth.getUser().then(function (userRes) {
			var userId = userRes.data && userRes.data.user && userRes.data.user.id;
			return supabase.from("notification_channels").select("*").eq("user_id", userId);
		}).then(function (res) {
			channels = res.data || [];
			// Auto-provisiona el canal in_app si falta, igual que el hook de React.
			if (!channels.some(function (c) { return c.channel_type === "in_app"; })) {
				return persistChannel("in_app", {}, true, true);
			}
		});
	}

	function persistChannel(type, config, enabled, silent) {
		return supabase.auth.getUser().then(function (userRes) {
			var userId = userRes.data && userRes.data.user && userRes.data.user.id;
			return supabase.from("notification_channels").upsert({
				user_id: userId, channel_type: type, config: config, enabled: enabled,
			}, { onConflict: "user_id,channel_type" });
		}).then(function (res) {
			if (res.error) {
				if (!silent) $("#channelsFormError").text("Error al guardar el canal.").removeClass("d-none");
				return;
			}
			return loadChannels().then(function () { if (!silent) renderChannelsTab(); });
		});
	}

	// --- Configuración general (alert_settings) ---
	function loadSettings() {
		return supabase.auth.getUser().then(function (userRes) {
			var userId = userRes.data && userRes.data.user && userRes.data.user.id;
			return supabase.from("alert_settings").select("*").eq("user_id", userId).maybeSingle();
		}).then(function (res) {
			if (res.data) {
				settings = {
					enabled: res.data.enabled,
					only_critical: res.data.only_critical,
					notify_frequency: res.data.notify_frequency || "daily",
				};
			}
		});
	}

	function saveSettings() {
		settings.enabled = $("#chEnabled").is(":checked");
		settings.only_critical = $("#onlyCritical").is(":checked");
		settings.notify_frequency = $("#notifyFrequency").val();
		return supabase.auth.getUser().then(function (userRes) {
			var userId = userRes.data && userRes.data.user && userRes.data.user.id;
			return supabase.from("alert_settings").upsert(
				Object.assign({ user_id: userId }, settings), { onConflict: "user_id" }
			);
		}).then(function (res) {
			$("#channelsSaved").addClass("d-none");
			if (res.error) { $("#channelsFormError").text("Error al guardar la configuración.").removeClass("d-none"); return; }
			$("#channelsFormError").addClass("d-none");
			$("#channelsSaved").removeClass("d-none");
			setTimeout(function () { $("#channelsSaved").addClass("d-none"); }, 2500);
		});
	}

	function renderChannelsTab() {
		$("#chEnabled").prop("checked", settings.enabled);
		$("#onlyCritical").prop("checked", settings.only_critical);
		$("#notifyFrequency").val(settings.notify_frequency);

		var email = getChannel("email");
		$("#chEmailEnabled").prop("checked", email.enabled);
		var recipients = email.config.recipients || [];
		$("#chEmailList").html(recipients.length
			? recipients.map(function (e) {
				return '<span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1 py-2">' + escapeHtml(e) +
					'<a href="javascript:;" class="remove-email-btn text-danger ms-1" data-email="' + escapeHtml(e) + '"><i class="fa fa-times"></i></a></span>';
			}).join("")
			: '<span class="fs-12 text-muted">Agrega al menos un correo para recibir alertas.</span>');

		var slack = getChannel("slack_webhook");
		$("#chSlackEnabled").prop("checked", slack.enabled);
		$("#chSlackUrl").val(slack.config.webhook_url || "");

		var webhook = getChannel("generic_webhook");
		$("#chWebhookEnabled").prop("checked", webhook.enabled);
		$("#chWebhookUrl").val(webhook.config.webhook_url || "");

		$("#chInAppEnabled").prop("checked", getChannel("in_app").enabled);
	}

	function addEmailRecipient() {
		var email = $("#chEmailInput").val().trim();
		if (!email) return;
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			$("#channelsFormError").text("Correo inválido.").removeClass("d-none");
			return;
		}
		$("#channelsFormError").addClass("d-none");
		var current = getChannel("email");
		var recipients = current.config.recipients || [];
		if (recipients.indexOf(email) === -1) {
			persistChannel("email", { recipients: recipients.concat([email]) }, true).then(renderChannelsTab);
		}
		$("#chEmailInput").val("");
	}

	// --- Insights de IA (campaign_ai_insights, generados por el deep-scan de alert-dispatch) ---
	function renderAiInsights(rows) {
		if (!rows.length) { $("#aiInsightsEmpty").removeClass("d-none"); $("#aiInsightsList").empty(); return; }
		$("#aiInsightsEmpty").addClass("d-none");
		$("#aiInsightsList").html('<div class="list-group list-group-flush">' + rows.map(function (r) {
			var cls = r.severity === "critical" ? "bg-danger" : r.severity === "warning" ? "bg-warning" : "bg-info";
			var d = new Date(r.created_at);
			var dateLabel = isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-CO");
			return (
				'<div class="list-group-item px-0"><div class="d-flex align-items-start gap-2">' +
				'<span class="' + cls + '" style="width:8px;height:8px;border-radius:50%;margin-top:6px;flex:none;"></span>' +
				'<div class="min-w-0">' +
				'<div class="d-flex align-items-center gap-2 flex-wrap"><strong class="fs-14">' + escapeHtml(r.campaign_name) + '</strong><span class="fs-11 text-muted">' + dateLabel + "</span></div>" +
				'<p class="fs-13 mb-0 mt-1">' + escapeHtml(r.finding) + "</p>" +
				'<p class="fs-13 text-muted mb-0">→ ' + escapeHtml(r.recommendation) + "</p>" +
				"</div></div></div>"
			);
		}).join("") + "</div>");
	}

	function loadAiInsights() {
		return supabase.from("campaign_ai_insights").select("*")
			.order("created_at", { ascending: false }).limit(20)
			.then(function (res) { renderAiInsights(res.data || []); });
	}

	// --- Enviar alertas ahora (Edge Function alert-dispatch) ---
	function sendNow() {
		var $btn = $("#sendNowBtn");
		$btn.prop("disabled", true).html('<span class="spinner-border spinner-border-sm me-1"></span>Enviando…');
		$("#channelsFormError").addClass("d-none");
		supabase.functions.invoke("alert-dispatch", { body: {} }).then(function (res) {
			var data = res.data, error = res.error;
			var userResult = data && data.results ? Object.values(data.results)[0] : null;
			if (error || (data && data.error)) {
				var msg = (error && error.message) || (data && data.error) || "Error desconocido";
				$("#channelsFormError").text("Error al enviar: " + msg).removeClass("d-none");
			} else if (!userResult || !userResult.sent) {
				$("#channelsSaved").removeClass("d-none").text("No se envió nada — verifica que al menos un canal esté habilitado, o que haya alertas activas.");
				setTimeout(function () { $("#channelsSaved").addClass("d-none"); }, 4000);
			} else {
				var channelList = (userResult.channels || []).map(function (c) { return c.channel; }).join(", ");
				$("#channelsSaved").removeClass("d-none").text(userResult.sent + " alerta(s) enviada(s) por " + (channelList || "ningún canal") + ".");
				setTimeout(function () { $("#channelsSaved").addClass("d-none"); }, 4000);
			}
		}).catch(function (e) {
			$("#channelsFormError").text("Error al enviar: " + e.message).removeClass("d-none");
		}).then(function () {
			$btn.prop("disabled", false).html('<i class="fa fa-paper-plane me-1"></i>Enviar alertas ahora');
		});
	}

	function loadRules() {
		return supabase.auth.getUser().then(function (userRes) {
			var userId = userRes.data && userRes.data.user && userRes.data.user.id;
			return supabase.from("alert_rules").select("*").eq("user_id", userId);
		}).then(function (res) {
			var byType = {};
			(res.data || []).forEach(function (r) { byType[r.rule_type] = r; });
			rules = RULE_TYPES.map(function (type) {
				var row = byType[type];
				var info = RULE_INFO[type];
				return {
					type: type,
					enabled: row ? row.enabled : true,
					threshold: row && row.threshold != null ? Number(row.threshold) : info.def,
				};
			});
		});
	}

	function thresholdsAndEnabled() {
		var t = {};
		var enabled = new Set();
		rules.forEach(function (r) {
			t[RULE_INFO[r.type].field] = r.threshold;
			if (r.enabled) enabled.add(r.type);
		});
		return { thresholds: t, enabledTypes: enabled };
	}

	function renderRules() {
		$("#rulesList").html(rules.map(function (r) {
			var info = RULE_INFO[r.type];
			return (
				'<div class="card mb-2"><div class="card-body">' +
				'<div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">' +
				"<div>" +
				'<div class="d-flex align-items-center gap-2">' +
				'<div class="form-check form-switch"><input class="form-check-input rule-enabled" type="checkbox" data-type="' + r.type + '" ' + (r.enabled ? "checked" : "") + "></div>" +
				"<h5 class=\"mb-0\">" + info.label + "</h5>" +
				"</div>" +
				'<p class="fs-13 text-muted mb-0 mt-1">' + info.desc + "</p>" +
				"</div>" +
				'<div class="d-flex align-items-center gap-2">' +
				'<input type="number" class="form-control rule-threshold" data-type="' + r.type + '" value="' + r.threshold + '" style="width:90px;">' +
				'<span class="fs-12 text-muted" style="max-width:120px;">' + info.unit + "</span>" +
				'<button type="button" class="btn btn-outline-primary btn-sm save-rule-btn" data-type="' + r.type + '">Guardar</button>' +
				"</div></div></div></div>"
			);
		}).join(""));
	}

	$(document).on("click", ".save-rule-btn", function () {
		var type = $(this).data("type");
		var rule = rules.filter(function (r) { return r.type === type; })[0];
		if (!rule) return;
		rule.enabled = $('.rule-enabled[data-type="' + type + '"]').is(":checked");
		rule.threshold = parseFloat($('.rule-threshold[data-type="' + type + '"]').val()) || RULE_INFO[type].def;
		supabase.auth.getUser().then(function (userRes) {
			var userId = userRes.data && userRes.data.user && userRes.data.user.id;
			return supabase.from("alert_rules").upsert({
				user_id: userId, rule_type: type, enabled: rule.enabled, threshold: rule.threshold,
			}, { onConflict: "user_id,rule_type" });
		}).then(function (res) {
			if (res.error) { alert("Error al guardar la regla."); return; }
			loadAndRenderAlerts();
		});
	});

	function accentClass(severity) {
		if (severity === "danger") return "bg-danger";
		if (severity === "warning") return "bg-warning";
		return "bg-info";
	}

	function renderStats(campaignAlerts, healthyCount) {
		var danger = campaignAlerts.filter(function (a) { return a.alert.severity === "danger"; }).length;
		var warning = campaignAlerts.filter(function (a) { return a.alert.severity === "warning"; }).length;
		var info = campaignAlerts.filter(function (a) { return a.alert.severity === "info"; }).length;
		function tile(label, value, icon, bg) {
			return '<div class="col-6 col-md-3"><div class="card widget-stat"><div class="card-body p-3"><div class="media align-items-center"><div class="media-body"><p class="fs-13 mb-1">' + label + '</p><h3 class="mb-0">' + value + '</h3></div><span class="ms-3 ' + bg + ' text-white"><i class="' + icon + '"></i></span></div></div></div></div>';
		}
		$("#alertStats").html(
			tile("Críticas", danger, "fa fa-exclamation-circle", "bg-danger") +
			tile("Advertencias", warning, "fa fa-exclamation-triangle", "bg-warning") +
			tile("Atención", info, "fa fa-info-circle", "bg-info") +
			tile("Saludables", healthyCount, "fa fa-check", "bg-success")
		);
	}

	function renderFeed(campaignAlerts) {
		if (!campaignAlerts.length) { $("#alertsEmpty").removeClass("d-none"); $("#alertsFeed").empty(); return; }
		$("#alertsEmpty").addClass("d-none");
		$("#alertsFeed").html(campaignAlerts.map(function (a) {
			return (
				'<div class="card mb-2"><div class="card-body d-flex align-items-start gap-3">' +
				'<span class="' + accentClass(a.alert.severity) + ' text-white rounded d-flex align-items-center justify-content-center" style="width:36px;height:36px;flex:none;font-size:16px;">' + a.alert.icon + "</span>" +
				"<div class=\"min-w-0\">" +
				'<div class="fw-medium">' + escapeHtml(a.clientName) + " · " + escapeHtml(a.campaign) + "</div>" +
				'<div class="fs-13 text-muted mt-1">' + escapeHtml(a.alert.message) + "</div>" +
				"</div></div></div>"
			);
		}).join(""));
	}

	function loadAndRenderAlerts() {
		var scope = thresholdsAndEnabled();
		return supabase.from("audit_clients").select("id, name").then(function (clientsRes) {
			var clients = clientsRes.data || [];
			return supabase.from("audit_records").select("*").then(function (recordsRes) {
				var records = recordsRes.data || [];
				return WindsorClient.fetchMetrics({ raw: true }).catch(function () { return { dailyCampaignTotals: [] }; }).then(function (windsorData) {
					var daily = windsorData.dailyCampaignTotals || [];
					var campaignAlerts = [];
					var healthyCount = 0;
					clients.forEach(function (client) {
						var clientRecords = records.filter(function (r) { return r.client_id === client.id; });
						var rows = AuditLib.buildAuditRows(clientRecords, daily, scope.thresholds, scope.enabledTypes);
						rows.forEach(function (row) {
							if (row.alerts.length === 0) { healthyCount++; return; }
							row.alerts.forEach(function (alert) {
								campaignAlerts.push({ clientName: client.name, campaign: row.campaign_name, alert: alert });
							});
						});
					});
					// Críticas primero
					campaignAlerts.sort(function (a, b) {
						var order = { danger: 0, warning: 1, info: 2 };
						return order[a.alert.severity] - order[b.alert.severity];
					});
					renderStats(campaignAlerts, healthyCount);
					renderFeed(campaignAlerts);
				});
			});
		});
	}

	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	// --- Eventos: tab "Canales" ---
	$("#chEmailAdd").on("click", addEmailRecipient);
	$("#chEmailInput").on("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addEmailRecipient(); } });
	$(document).on("click", ".remove-email-btn", function () {
		var email = $(this).data("email");
		var current = getChannel("email");
		var recipients = (current.config.recipients || []).filter(function (e) { return e !== email; });
		persistChannel("email", { recipients: recipients }, current.enabled).then(renderChannelsTab);
	});
	$("#chEmailEnabled").on("change", function () {
		persistChannel("email", getChannel("email").config, $(this).is(":checked")).then(renderChannelsTab);
	});
	$("#chSlackEnabled").on("change", function () {
		persistChannel("slack_webhook", getChannel("slack_webhook").config, $(this).is(":checked")).then(renderChannelsTab);
	});
	$("#chSlackUrl").on("blur", function () {
		var val = $(this).val().trim();
		if (val) persistChannel("slack_webhook", { webhook_url: val }, true).then(renderChannelsTab);
	});
	$("#chWebhookEnabled").on("change", function () {
		persistChannel("generic_webhook", getChannel("generic_webhook").config, $(this).is(":checked")).then(renderChannelsTab);
	});
	$("#chWebhookUrl").on("blur", function () {
		var val = $(this).val().trim();
		if (val) persistChannel("generic_webhook", { webhook_url: val }, true).then(renderChannelsTab);
	});
	$("#chInAppEnabled").on("change", function () {
		persistChannel("in_app", {}, $(this).is(":checked")).then(renderChannelsTab);
	});
	$("#saveSettingsBtn").on("click", saveSettings);
	$("#sendNowBtn").on("click", sendNow);

	AuditClient.getSession().then(function (session) {
		if (!session) { showOnly($authRequired); window.location.replace("page-login.html"); return; }
		showOnly($loading);
		Promise.all([loadRules(), loadChannels(), loadSettings(), loadAiInsights()]).then(function () {
			renderRules();
			renderChannelsTab();
			return supabase.from("audit_clients").select("id").limit(1);
		}).then(function (res) {
			if (res.error) { showOnly($migrationPending); return; }
			return loadAndRenderAlerts().then(function () { showOnly($content); });
		}).catch(function (err) { console.error(err); });
	});
})(jQuery);
