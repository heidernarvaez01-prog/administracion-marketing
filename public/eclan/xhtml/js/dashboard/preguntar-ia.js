(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;
	var SUPABASE_URL = "https://szdivobcbdkiszgrizic.supabase.co";
	var SUPABASE_ANON_KEY = "sb_publishable_ldumgPigulWT8adpCHpa_Q_dLVy4EC-";

	var SUGGESTIONS = [
		"¿Cómo va esta campaña esta semana?",
		"¿El ritmo de gasto va bien?",
		"Dame 3 optimizaciones accionables",
		"¿Hay alguna alerta de costo o entrega?",
		"¿Qué campañas tienen el peor CTR y por qué?",
		"Resume el rendimiento general de esta semana",
	];

	var messages = [];
	var loading = false;
	var clients = [];

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	// Markdown liviano: negrita, cursiva, listas y párrafos — suficiente
	// para el formato típico de una respuesta de IA (no hay react-markdown acá).
	function mdToHtml(md) {
		var lines = String(md || "").split("\n");
		var html = "";
		var inList = false;
		lines.forEach(function (line) {
			var trimmed = line.trim();
			if (/^[-*]\s+/.test(trimmed)) {
				if (!inList) { html += "<ul>"; inList = true; }
				html += "<li>" + inlineMd(trimmed.replace(/^[-*]\s+/, "")) + "</li>";
			} else {
				if (inList) { html += "</ul>"; inList = false; }
				if (trimmed === "") return;
				if (/^#{1,4}\s+/.test(trimmed)) {
					var level = trimmed.match(/^#+/)[0].length;
					html += "<h" + Math.min(level + 3, 6) + ">" + inlineMd(trimmed.replace(/^#{1,4}\s+/, "")) + "</h" + Math.min(level + 3, 6) + ">";
				} else {
					html += "<p>" + inlineMd(trimmed) + "</p>";
				}
			}
		});
		if (inList) html += "</ul>";
		return html;
	}
	function inlineMd(s) {
		s = escapeHtml(s);
		s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
		s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
		return s;
	}

	function renderSuggestions() {
		if (messages.length > 0) { $("#suggestions").empty(); $("#clearChatBtn").removeClass("d-none"); return; }
		$("#clearChatBtn").addClass("d-none");
		$("#suggestions").html(SUGGESTIONS.map(function (s) {
			return '<div class="col-md-6 mb-2"><button type="button" class="btn btn-outline-secondary text-start w-100 suggestion-btn">' + escapeHtml(s) + "</button></div>";
		}).join(""));
	}

	function renderMessages() {
		var html = messages.map(function (m) {
			return (
				'<div class="card mb-2' + (m.role === "user" ? " bg-light" : "") + '"><div class="card-body py-3">' +
				'<div class="fs-12 text-muted mb-1">' + (m.role === "user" ? "Tú" : "Análisis de IA") + "</div>" +
				'<div class="fs-14">' + (m.role === "user" ? escapeHtml(m.content) : mdToHtml(m.content)) + "</div>" +
				"</div></div>"
			);
		}).join("");
		if (loading) {
			html += '<div class="card mb-2"><div class="card-body py-3 text-muted fs-14"><i class="fa fa-spinner fa-spin me-2"></i>Analizando…</div></div>';
		}
		$("#chatMessages").html(html);
		var el = document.getElementById("chatMessages");
		el.scrollTop = el.scrollHeight;
	}

	function loadClients() {
		supabase.from("audit_clients").select("id, name").order("name").then(function (res) {
			clients = res.data || [];
			$("#scopeClient").html('<option value="">Todos los clientes</option>' + clients.map(function (c) {
				return '<option value="' + c.id + '">' + escapeHtml(c.name) + "</option>";
			}).join(""));
		});
	}

	$("#scopeClient").on("change", function () {
		var clientId = $(this).val();
		var $campaign = $("#scopeCampaign");
		if (!clientId) { $campaign.html('<option value="">Todas las campañas</option>').prop("disabled", true); return; }
		supabase.from("audit_records").select("campaign_name").eq("client_id", clientId).then(function (res) {
			var names = Array.from(new Set((res.data || []).map(function (r) { return r.campaign_name; }).filter(Boolean))).sort();
			$campaign.html('<option value="">Todas las campañas</option>' + names.map(function (n) {
				return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + "</option>";
			}).join("")).prop("disabled", false);
		});
	});

	function ask(question) {
		question = (question || "").trim();
		if (!question || loading) return;
		messages.push({ role: "user", content: question });
		$("#questionInput").val("");
		loading = true;
		renderSuggestions();
		renderMessages();

		var clientId = $("#scopeClient").val() || undefined;
		var campaignName = $("#scopeCampaign").val() || undefined;

		AuditClient.getSession().then(function (session) {
			return fetch(SUPABASE_URL + "/functions/v1/metrics-ai-analysis", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + (session ? session.access_token : SUPABASE_ANON_KEY),
					apikey: SUPABASE_ANON_KEY,
				},
				body: JSON.stringify({ question: question, clientId: clientId, campaignName: campaignName }),
			});
		}).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
			.then(function (result) {
				if (!result.ok || result.data.error) throw new Error((result.data && result.data.error) || "Falló el análisis");
				messages.push({ role: "assistant", content: result.data.answer });
			})
			.catch(function (err) {
				alert((err && err.message) || "Falló el análisis");
				messages.pop();
			})
			.then(function () {
				loading = false;
				renderSuggestions();
				renderMessages();
			});
	}

	$(document).on("click", ".suggestion-btn", function () { ask($(this).text()); });
	$("#askForm").on("submit", function (e) { e.preventDefault(); ask($("#questionInput").val()); });
	$("#questionInput").on("keydown", function (e) {
		if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask($(this).val()); }
	});
	$("#clearChatBtn").on("click", function () { messages = []; renderSuggestions(); renderMessages(); });
	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	AuditClient.getSession().then(function (session) {
		if (!session) { $("#askContent").addClass("d-none"); $("#authRequired").removeClass("d-none"); window.location.replace("page-login.html"); return; }
		loadClients();
		renderSuggestions();
	});
})(jQuery);
