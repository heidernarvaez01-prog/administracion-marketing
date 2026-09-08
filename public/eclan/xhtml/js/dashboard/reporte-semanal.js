(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;
	var SUPABASE_URL = "https://szdivobcbdkiszgrizic.supabase.co";
	var SUPABASE_ANON_KEY = "sb_publishable_ldumgPigulWT8adpCHpa_Q_dLVy4EC-";
	var clientId = new URLSearchParams(window.location.search).get("client_id");

	var $loading = $("#reportLoading");
	var $content = $("#reportContent");
	var $migrationPending = $("#migrationPending");
	var $authRequired = $("#authRequired");
	var $clientNotFound = $("#clientNotFound");

	function showOnly($el) {
		[$loading, $content, $migrationPending, $authRequired, $clientNotFound].forEach(function ($x) { $x.addClass("d-none"); });
		if ($el) $el.removeClass("d-none");
	}

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	var clientName = "";
	var recipients = [];
	var reports = [];

	function renderRecipients() {
		if (!recipients.length) {
			$("#recipientsList").html('<p class="fs-13 text-muted mb-0">Aún no hay destinatarios — el correo de los lunes se omite para este cliente.</p>');
			return;
		}
		$("#recipientsList").html(recipients.map(function (e) {
			return '<span class="badge bg-light text-dark d-inline-flex align-items-center gap-2 py-2 px-3">' + escapeHtml(e) +
				' <a href="javascript:;" class="remove-recipient text-danger" data-email="' + escapeHtml(e) + '"><i class="fa fa-times"></i></a></span>';
		}).join(""));
	}

	$("#addEmailBtn").on("click", addEmail);
	$("#emailInput").on("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addEmail(); } });
	function addEmail() {
		var email = $("#emailInput").val().trim();
		if (!email) return;
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert("Correo inválido"); return; }
		if (recipients.indexOf(email) === -1) recipients.push(email);
		$("#emailInput").val("");
		renderRecipients();
	}
	$(document).on("click", ".remove-recipient", function () {
		var email = $(this).data("email");
		recipients = recipients.filter(function (e) { return e !== email; });
		renderRecipients();
	});
	$("#saveRecipientsBtn").on("click", function () {
		supabase.from("audit_clients").update({ report_recipients: recipients }).eq("id", clientId).then(function (res) {
			alert(res.error ? "Error al guardar los destinatarios." : "Destinatarios guardados.");
		});
	});

	function fmtSentAt(iso) {
		return new Date(iso).toLocaleString("es-CO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
	}

	function renderReports() {
		$("#reportsCount").text(reports.length);
		if (!reports.length) { $("#reportsEmpty").removeClass("d-none"); $("#reportsList").addClass("d-none"); return; }
		$("#reportsEmpty").addClass("d-none");
		$("#reportsList").removeClass("d-none").html(reports.map(function (r) {
			var status = r.sent_at
				? "Enviado " + fmtSentAt(r.sent_at) + " a " + (r.sent_to || []).length + " destinatario(s)"
				: "No enviado";
			return (
				'<div class="d-flex align-items-center justify-content-between py-2 border-bottom">' +
				'<div><div class="fw-medium">' + r.week_start + " → " + r.week_end + '</div><div class="fs-12 text-muted">' + status + "</div></div>" +
				"<div>" +
				(r.sent_at ? '<span class="badge bg-success-light text-success me-2">Enviado</span>' : "") +
				'<a href="javascript:;" class="btn btn-light btn-sm sharp me-1 view-report-btn" data-id="' + r.id + '"><i class="fa fa-eye"></i></a>' +
				'<a href="javascript:;" class="btn btn-light btn-sm sharp delete-report-btn" data-id="' + r.id + '"><i class="fa fa-trash text-danger"></i></a>' +
				"</div></div>"
			);
		}).join(""));
	}

	function loadReports() {
		return supabase.from("weekly_reports").select("id, week_start, week_end, sent_at, sent_to, created_at").eq("client_id", clientId).order("week_start", { ascending: false })
			.then(function (res) { reports = res.data || []; renderReports(); });
	}

	function openViewer(html, title) {
		$("#viewerTitle").text(title);
		document.getElementById("viewerFrame").srcdoc = html;
		$("#clusterViewer").removeClass("d-none").data("html", html).data("title", title);
	}
	$("#viewerCloseBtn").on("click", function () { $("#clusterViewer").addClass("d-none"); });
	$("#viewerDownloadBtn").on("click", function () {
		var html = $("#clusterViewer").data("html");
		var title = $("#clusterViewer").data("title") || "reporte";
		var blob = new Blob([html], { type: "text/html;charset=utf-8" });
		var url = URL.createObjectURL(blob);
		var a = document.createElement("a");
		a.href = url;
		a.download = String(title).replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").toLowerCase() + ".html";
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	});

	$(document).on("click", ".view-report-btn", function () {
		var id = $(this).data("id");
		var r = reports.filter(function (x) { return String(x.id) === String(id); })[0];
		supabase.from("weekly_reports").select("html").eq("id", id).maybeSingle().then(function (res) {
			if (!res.data || !res.data.html) { alert("Este reporte no tiene contenido."); return; }
			openViewer(res.data.html, "Reporte semanal — " + clientName + " (" + (r ? r.week_start + " → " + r.week_end : "") + ")");
		});
	});

	var deleteTargetId = null;
	$(document).on("click", ".delete-report-btn", function () {
		deleteTargetId = $(this).data("id");
		bootstrap.Modal.getOrCreateInstance(document.getElementById("deleteRunModal")).show();
	});
	$("#confirmDeleteRunBtn").on("click", function () {
		if (!deleteTargetId) return;
		supabase.from("weekly_reports").delete().eq("id", deleteTargetId).then(function () {
			bootstrap.Modal.getOrCreateInstance(document.getElementById("deleteRunModal")).hide();
			deleteTargetId = null;
			loadReports();
		});
	});

	function generate(send) {
		if (send && recipients.length === 0) { alert("Agrega destinatarios antes de enviar."); return; }
		var $btn = send ? $("#sendBtn") : $("#previewBtn");
		var originalHtml = $btn.html();
		$btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin me-2"></i>' + (send ? "Enviando…" : "Generando…"));

		AuditClient.getSession().then(function (session) {
			return fetch(SUPABASE_URL + "/functions/v1/weekly-report", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + (session ? session.access_token : SUPABASE_ANON_KEY),
					apikey: SUPABASE_ANON_KEY,
				},
				body: JSON.stringify({ clientId: clientId, send: send, includeMonthly: true }),
			});
		}).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
			.then(function (result) {
				if (!result.ok || result.data.error) throw new Error((result.data && result.data.error) || "Falló la generación del reporte");
				if (result.data.html) {
					openViewer(result.data.html, "Reporte semanal — " + clientName + " (" + result.data.week_start + " → " + result.data.week_end + ")");
				}
				alert(send ? "Reporte enviado a " + recipients.length + " destinatario(s)." : "Reporte generado.");
				return loadReports();
			})
			.catch(function (err) { alert((err && err.message) || "Falló la generación del reporte"); })
			.then(function () { $btn.prop("disabled", false).html(originalHtml); });
	}

	$("#previewBtn").on("click", function () { generate(false); });
	$("#sendBtn").on("click", function () { generate(true); });
	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	if (!clientId) {
		showOnly($clientNotFound);
	} else {
		AuditClient.getSession().then(function (session) {
			if (!session) { showOnly($authRequired); window.location.replace("page-login.html"); return; }
			showOnly($loading);
			supabase.from("audit_clients").select("id, name, report_recipients").eq("id", clientId).maybeSingle()
				.then(function (res) {
					if (res.error) { showOnly($migrationPending); return; }
					if (!res.data) { showOnly($clientNotFound); return; }
					clientName = res.data.name;
					recipients = res.data.report_recipients || [];
					$("#clientTitle").text(clientName + " — Reporte semanal");
					renderRecipients();
					return loadReports();
				})
				.then(function () { showOnly($content); })
				.catch(function (err) { console.error(err); });
		});
	}
})(jQuery);
