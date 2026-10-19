(function ($) {
	"use strict";
	if (typeof AuditClient === "undefined") return;
	var sb = AuditClient.supabase;
	var clients = {};
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
	function urlFor(t) { return location.origin + "/eclan/xhtml/compartir.html?t=" + t; }

	function load() {
		sb.from("audit_clients").select("id,name").order("name").then(function (r) {
			(r.data || []).forEach(function (c) { clients[c.id] = c.name; });
			$("#shareClient").html((r.data || []).map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + "</option>"; }).join(""));
			sb.from("share_links").select("token,client_id,active,created_at").order("created_at", { ascending: false }).then(function (s) {
				var rows = s.data || [];
				$("#shareList").html(rows.length ? rows.map(function (l) {
					var u = urlFor(l.token);
					return "<tr><td>" + esc(clients[l.client_id] || "") + '</td><td style="max-width:360px"><input class="form-control form-control-sm" readonly value="' + esc(u) + '"></td><td>' +
						(l.active ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-light text-muted">Apagado</span>') + '</td><td class="text-nowrap">' +
						(l.active ? '<button class="btn btn-xs btn-outline-primary me-1" data-copy="' + esc(u) + '">Copiar</button><a class="btn btn-xs btn-outline-primary me-1" target="_blank" href="' + esc(u) + '">Abrir</a>' : "") +
						'<button class="btn btn-xs ' + (l.active ? "btn-outline-danger" : "btn-outline-success") + '" data-toggle-token="' + l.token + '" data-active="' + l.active + '">' + (l.active ? "Apagar" : "Encender") + "</button></td></tr>";
				}).join("") : '<tr><td colspan="4" class="text-muted">Aún no hay enlaces.</td></tr>');
			});
		});
	}
	$("#shareCreate").on("click", function () {
		var id = $("#shareClient").val(); if (!id) return;
		sb.auth.getUser().then(function (u) {
			sb.from("share_links").insert({ client_id: id, created_by: u.data.user && u.data.user.id }).then(function (r) { if (r.error) alert(r.error.message); load(); });
		});
	});
	$(document).on("click", "[data-toggle-token]", function () {
		var on = $(this).data("active") === true || $(this).data("active") === "true";
		sb.from("share_links").update({ active: !on }).eq("token", $(this).data("toggle-token")).then(load);
	});
	$(document).on("click", "[data-copy]", function () {
		var b = $(this); navigator.clipboard.writeText(b.data("copy")).then(function () { b.text("Copiado"); });
	});
	AuditClient.getSession().then(function (s) { if (s) load(); });
})(jQuery);
