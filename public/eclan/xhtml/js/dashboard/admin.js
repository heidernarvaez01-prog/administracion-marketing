(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;
	var currentUserId = null;

	var $loading = $("#adminLoading");
	var $content = $("#adminContent");
	var $authRequired = $("#authRequired");
	var $notAdmin = $("#notAdmin");

	function showOnly($el) {
		[$loading, $content, $authRequired, $notAdmin].forEach(function ($x) { $x.addClass("d-none"); });
		if ($el) $el.removeClass("d-none");
	}

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	var users = [], accounts = [], assignments = [], roles = [];

	function isAdminUser(uid) { return roles.some(function (r) { return r.user_id === uid && r.role === "admin"; }); }
	function assignmentsFor(uid) { return assignments.filter(function (a) { return a.user_id === uid; }); }

	function renderStats() {
		function tile(label, value, icon, bg) {
			return '<div class="col-6 col-md-3"><div class="card widget-stat"><div class="card-body p-3"><div class="media align-items-center"><div class="media-body"><p class="fs-13 mb-1">' + label + '</p><h3 class="mb-0">' + value + '</h3></div><span class="ms-3 ' + bg + ' text-white"><i class="' + icon + '"></i></span></div></div></div></div>';
		}
		$("#adminStats").html(
			tile("Miembros", users.length, "fa fa-users", "bg-primary") +
			tile("Admins", roles.filter(function (r) { return r.role === "admin"; }).length, "fa fa-shield", "bg-secondary") +
			tile("Asignaciones", assignments.length, "fa fa-link", "bg-info") +
			tile("Cuentas", accounts.length, "fa fa-building", "bg-success")
		);
	}

	function renderAccountOptions() {
		$("#formAccount").html('<option value="">Sin cuenta aún</option>' + accounts.map(function (a) {
			var key = a.account_id + "|" + (a.platform || "");
			return '<option value="' + escapeHtml(key) + '">' + escapeHtml(a.account_name || a.account_id) + (a.platform ? " (" + escapeHtml(a.platform) + ")" : "") + "</option>";
		}).join(""));
	}

	function renderMembers() {
		if (!users.length) {
			$("#membersTableBody").html('<tr><td colspan="4" class="text-center text-muted py-4">Aún no hay miembros invitados.</td></tr>');
			return;
		}
		$("#membersTableBody").html(users.map(function (u) {
			var admin = isAdminUser(u.id);
			var accs = assignmentsFor(u.id);
			var accHtml = accs.length
				? accs.map(function (a) { return '<span class="badge bg-light text-dark me-1 mb-1">' + escapeHtml(a.account_name || a.account_id) + '<a href="javascript:;" class="text-danger ms-1 remove-assignment-btn" data-id="' + a.id + '"><i class="fa fa-times"></i></a></span>'; }).join("")
				: '<span class="text-muted fs-12">Ninguna</span>';
			return (
				"<tr>" +
				"<td>" + escapeHtml(u.email) + (u.confirmed === false ? ' <span class="badge bg-light text-muted">Invitado</span>' : "") + "</td>" +
				'<td><span class="badge ' + (admin ? "bg-primary" : "bg-light text-dark") + '">' + (admin ? "Admin" : "Miembro") + "</span></td>" +
				"<td>" + accHtml + "</td>" +
				'<td class="text-end">' +
				'<div class="dropdown"><a href="javascript:;" data-bs-toggle="dropdown"><i class="fa fa-ellipsis-v"></i></a>' +
				'<div class="dropdown-menu dropdown-menu-end">' +
				'<a href="javascript:;" class="dropdown-item toggle-admin-btn" data-id="' + u.id + '">' + (admin ? "Quitar admin" : "Hacer admin") + "</a>" +
				'<a href="javascript:;" class="dropdown-item send-reset-btn" data-email="' + escapeHtml(u.email) + '">Enviar reset de contraseña</a>' +
				'<a href="javascript:;" class="dropdown-item resend-invite-btn" data-email="' + escapeHtml(u.email) + '">Reenviar invitación</a>' +
				'<a href="javascript:;" class="dropdown-item text-danger revoke-access-btn" data-id="' + u.id + '" data-email="' + escapeHtml(u.email) + '">Revocar acceso</a>' +
				"</div></div></td></tr>"
			);
		}).join(""));
	}

	function loadData() {
		return Promise.all([
			supabase.functions.invoke("admin-users"),
			supabase.from("meta_datos").select("account_id, account_name, plataforma").not("account_id", "is", null),
			supabase.from("account_assignments").select("*").order("created_at", { ascending: false }),
			supabase.from("user_roles").select("user_id, role"),
		]).then(function (results) {
			var usersRes = results[0], accountsRes = results[1], assignmentsRes = results[2], rolesRes = results[3];
			users = (usersRes.data && usersRes.data.users) || [];
			assignments = assignmentsRes.data || [];
			roles = rolesRes.data || [];
			var seen = {};
			accounts = [];
			(accountsRes.data || []).forEach(function (r) {
				var key = r.account_id + "|" + (r.plataforma || "");
				if (seen[key] || !r.account_id) return;
				seen[key] = true;
				accounts.push({ account_id: r.account_id, account_name: r.account_name, platform: r.plataforma });
			});
			renderStats();
			renderAccountOptions();
			renderMembers();
		});
	}

	$("#submitFormBtn").on("click", function () {
		var email = $("#formEmail").val().trim().toLowerCase();
		var role = $("#formRole").val();
		var accountKey = $("#formAccount").val();
		var $err = $("#formError").addClass("d-none");

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $err.text("Correo inválido.").removeClass("d-none"); return; }

		var existing = users.filter(function (u) { return (u.email || "").toLowerCase() === email; })[0];
		var uidPromise;
		if (existing) {
			uidPromise = Promise.resolve(existing.id);
		} else {
			uidPromise = supabase.functions.invoke("admin-users", { body: { action: "invite", email: email, redirectTo: window.location.origin + "/eclan/xhtml/page-login.html" } })
				.then(function (res) {
					if (res.error || (res.data && res.data.error)) throw new Error((res.error && res.error.message) || (res.data && res.data.error) || "No se pudo enviar la invitación");
					return loadData().then(function () {
						var found = users.filter(function (u) { return (u.email || "").toLowerCase() === email; })[0];
						return found ? found.id : null;
					});
				});
		}

		uidPromise.then(function (uid) {
			if (!uid) throw new Error("No se pudo identificar al miembro después de invitarlo.");
			var chain = Promise.resolve();
			if (role === "admin" && !isAdminUser(uid)) {
				chain = chain.then(function () { return supabase.from("user_roles").insert({ user_id: uid, role: "admin" }); });
			} else if (role === "user") {
				chain = chain.then(function () { return supabase.from("user_roles").upsert({ user_id: uid, role: "user" }, { onConflict: "user_id,role" }); });
			}
			if (accountKey) {
				var acc = accounts.filter(function (a) { return (a.account_id + "|" + (a.platform || "")) === accountKey; })[0];
				if (acc) {
					chain = chain.then(function () {
						return supabase.from("account_assignments").insert({
							user_id: uid, account_id: acc.account_id, account_name: acc.account_name, platform: acc.platform, created_by: currentUserId,
						});
					});
				}
			}
			return chain;
		}).then(function () {
			$("#formEmail").val("");
			$("#formAccount").val("");
			$("#formRole").val("user");
			return loadData();
		}).catch(function (err) {
			$err.text((err && err.message) || "Error inesperado.").removeClass("d-none");
		});
	});

	$(document).on("click", ".toggle-admin-btn", function () {
		var uid = $(this).data("id");
		var chain = isAdminUser(uid)
			? supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin")
			: supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
		chain.then(function (res) { if (res.error) { alert("Error: " + res.error.message); return; } loadData(); });
	});

	$(document).on("click", ".send-reset-btn", function () {
		var email = $(this).data("email");
		supabase.functions.invoke("admin-users", { body: { action: "reset_password", email: email, redirectTo: window.location.origin + "/eclan/xhtml/page-login.html" } })
			.then(function (res) {
				if (res.error || (res.data && res.data.error)) { alert("No se pudo enviar el link."); return; }
				alert("Link de reseteo enviado a " + email);
			});
	});

	$(document).on("click", ".resend-invite-btn", function () {
		var email = $(this).data("email");
		supabase.functions.invoke("admin-users", { body: { action: "invite", email: email, redirectTo: window.location.origin + "/eclan/xhtml/page-login.html" } })
			.then(function (res) {
				if (res.error || (res.data && res.data.error)) { alert("No se pudo reenviar."); return; }
				alert("Invitación reenviada a " + email);
			});
	});

	$(document).on("click", ".revoke-access-btn", function () {
		var uid = $(this).data("id"), email = $(this).data("email");
		if (!confirm("¿Revocar el acceso de " + email + "?")) return;
		var target = users.filter(function (u) { return u.id === uid; })[0];
		if (target && target.confirmed === false) {
			supabase.functions.invoke("admin-users", { body: { action: "delete_user", userId: uid } }).then(function () { loadData(); });
			return;
		}
		Promise.all([
			supabase.from("account_assignments").delete().eq("user_id", uid),
			supabase.from("user_roles").delete().eq("user_id", uid),
		]).then(function () { loadData(); });
	});

	$(document).on("click", ".remove-assignment-btn", function () {
		supabase.from("account_assignments").delete().eq("id", $(this).data("id")).then(function () { loadData(); });
	});

	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	AuditClient.getSession().then(function (session) {
		if (!session) { showOnly($authRequired); window.location.replace("page-login.html"); return; }
		currentUserId = session.user.id;
		showOnly($loading);
		supabase.from("user_roles").select("role").eq("user_id", currentUserId).eq("role", "admin").maybeSingle()
			.then(function (res) {
				if (!res.data) { showOnly($notAdmin); return; }
				return loadData().then(function () { showOnly($content); });
			})
			.catch(function (err) { console.error(err); showOnly($notAdmin); });
	});
})(jQuery);
