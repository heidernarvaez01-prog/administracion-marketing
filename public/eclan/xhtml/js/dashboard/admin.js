(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;
	var currentUserId = null;

	var REDIRECT_TO = window.location.origin + "/eclan/xhtml/page-set-password.html";

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
    var accessData = {};

	function isAdminUser(uid) { return roles.some(function (r) { return r.user_id === uid && r.role === "admin"; }); }
	function assignmentsFor(uid) {
        var visibleClientIds = (accessData.clientMembers || []).filter(function(m) { return m.user_id === uid; }).map(function(m) { return m.client_id; });
        var agencies = (accessData.agencyMembers || []).filter(function(m) { return m.user_id === uid; }).map(function(m) { return m.agency_id; });
        (accessData.clients || []).forEach(function(c) { if (agencies.includes(c.agency_id)) visibleClientIds.push(c.id); });
        var ids = (accessData.clientAccounts || []).filter(function(c) { return visibleClientIds.includes(c.client_id) || isAdminUser(uid); }).map(function(c) { return c.account_id; });
        var result = assignments.filter(function (a) { return a.user_id === uid; });
        (accessData.accounts || []).forEach(function(a) { if (ids.includes(a.account_id) && !result.some(function(r) { return r.account_id === a.account_id; })) result.push(a); });
        return result;
    }

    function accessLabel(uid) {
        var labels = [];
        (accessData.agencyMembers || []).filter(function(m) { return m.user_id === uid; }).forEach(function(m) {
            var agency = (accessData.agencies || []).find(function(a) { return a.id === m.agency_id; });
            labels.push('Manager · ' + escapeHtml(agency ? agency.name : 'Agencia'));
        });
        (accessData.clientMembers || []).filter(function(m) { return m.user_id === uid; }).forEach(function(m) {
            var client = (accessData.clients || []).find(function(a) { return a.id === m.client_id; });
            labels.push('Viewer · ' + escapeHtml(client ? client.name : 'Cliente'));
        });
        return labels.join('<br>') || 'Sin acceso';
    }
    var accessTarget = null;
    $('body').append('<div class="modal fade" id="memberAccessModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Cambiar acceso</h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body"><p id="memberAccessEmail"></p><div id="memberAccessError" class="alert alert-danger d-none"></div><label class="form-label" for="memberAccessRole">Rol</label><select id="memberAccessRole" class="form-control mb-3"><option value="viewer">Viewer de cliente</option><option value="manager">Manager de agencia</option></select><label class="form-label" for="memberAccessScope">Cliente o agencia</label><select id="memberAccessScope" class="form-control mb-3"></select><label class="form-label" for="memberAccessOperation">Acción</label><select id="memberAccessOperation" class="form-control"><option value="grant">Asignar acceso</option><option value="remove">Retirar acceso</option></select></div><div class="modal-footer"><button id="saveMemberAccess" class="btn btn-primary">Guardar acceso</button></div></div></div></div>');
    function accessScopes() {
        var items = $('#memberAccessRole').val() === 'manager' ? accessData.agencies : accessData.clients;
        $('#memberAccessScope').empty();
        (items || []).forEach(function(item) { $('#memberAccessScope').append($('<option>', { value:item.id, text:item.name })); });
    }
    $('#memberAccessRole').on('change', accessScopes);
    $(document).on('click', '.change-access-btn', function() {
        accessTarget = $(this).data('id');
        var user = users.find(function(u) { return u.id === accessTarget; });
        $('#memberAccessEmail').text(user ? user.email : '');
        $('#memberAccessError').addClass('d-none');
        accessScopes(); bootstrap.Modal.getOrCreateInstance(document.getElementById('memberAccessModal')).show();
    });
    $('#saveMemberAccess').on('click', function() {
        var button = $(this).prop('disabled', true);
        invokeAdmin({ action:'change_access', userId:accessTarget, accessRole:$('#memberAccessRole').val(), scopeId:$('#memberAccessScope').val(), operation:$('#memberAccessOperation').val() }).then(function() {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('memberAccessModal')).hide();
            $(document).trigger('apache360:users-changed'); return loadData();
        }).catch(function(err) { $('#memberAccessError').text(err.message).removeClass('d-none'); }).finally(function() { button.prop('disabled', false); });
    });

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

	function renderMembers() {
		if (!users.length) {
			$("#membersTableBody").html('<tr><td colspan="4" class="text-center text-muted py-4">Aún no hay miembros invitados.</td></tr>');
			return;
		}
		$("#membersTableBody").html(users.map(function (u) {
			var admin = isAdminUser(u.id);
			var accs = assignmentsFor(u.id);
			var accHtml = accs.length
				? accs.map(function (a) { return '<span class="badge bg-light text-dark me-1 mb-1">' + escapeHtml(a.account_name || a.account_id) + '</span>'; }).join("")
				: '<span class="text-muted fs-12">Ninguna</span>';
			return (
				"<tr>" +
				"<td>" + escapeHtml(u.email) + (u.confirmed === false ? ' <span class="badge bg-light text-muted">Invitado</span>' : "") + "</td>" +
				'<td><span class="badge ' + (admin ? "bg-primary" : "bg-light text-dark") + '">' + (admin ? "Administrador" : accessLabel(u.id)) + "</span></td>" +
				"<td>" + accHtml + "</td>" +
				'<td class="text-end">' +
                (!admin ? '<a href="javascript:;" class="btn btn-outline-primary btn-sm change-access-btn me-2" data-id="' + u.id + '">Cambiar acceso</a>' : '') +
				'<div class="dropdown"><a href="javascript:;" data-bs-toggle="dropdown"><i class="fa fa-ellipsis-v"></i></a>' +
				'<div class="dropdown-menu dropdown-menu-end">' +
                (!admin ? '<a href="javascript:;" class="dropdown-item change-access-btn" data-id="' + u.id + '">Cambiar acceso</a>' : '') +
				'<a href="javascript:;" class="dropdown-item set-password-btn" data-id="' + u.id + '" data-email="' + escapeHtml(u.email) + '">Establecer contraseña</a>' +
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
			if (usersRes.error) throw new Error(usersRes.error.context && usersRes.error.context.status === 401 ? 'Tu sesión venció. Inicia sesión nuevamente.' : 'No se pudieron cargar los miembros. Vuelve a cargar la lista.');
            for (var res of [accountsRes, assignmentsRes, rolesRes]) if (res.error) throw new Error(res.error.message);
            accessData = usersRes.data || {};
            users = accessData.users || [];
            $('#membersLoadError').remove();
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
			renderMembers();
        }).catch(function(err) {
            $('#membersTableBody').empty();
            $('#membersLoadError').remove();
            $('<div>', { id: 'membersLoadError', class: 'alert alert-danger', text: err.message }).append($('<button>', { type:'button', class:'btn btn-light btn-sm ms-2', text:'Volver a cargar' }).on('click', loadData)).insertBefore($('#membersTableBody').closest('.table-responsive'));
        });
	}

	function invokeAdmin(body) {
		return supabase.functions.invoke("admin-users", { body: body }).then(async function (res) {
			if (res.error) {
				var detail = null;
				if (res.error.context && typeof res.error.context.json === "function") {
					try { detail = await res.error.context.json(); } catch (_err) {}
				}
				throw new Error((detail && detail.error) || res.error.message || "No se pudo guardar.");
			}
			if (!res.data || res.data.error) throw new Error((res.data && res.data.error) || "Respuesta inválida.");
			return res.data;
		});
	}
	function requireDelivery(data) {
		if (!data.email || !data.email.sent) throw new Error("El correo no se envió. Puedes establecer la contraseña directamente en Equipo.");
		return data;
	}
	function passwordError(pw, confirmation) {
		if (pw.length < 8 || pw.length > 128) return "La contraseña debe tener entre 8 y 128 caracteres.";
		if (pw !== confirmation) return "Las contraseñas no coinciden.";
		return null;
	}
	$("#accountMethod").on("change", function () {
		var manual = $(this).val() === "manual";
		$(".manual-password-field").toggleClass("d-none", !manual);
		$("#formPassword, #formPasswordConfirm").val("");
		$("#submitFormBtn").text(manual ? "Crear cuenta" : "Enviar invitación");
	});
	$("#submitFormBtn").on("click", function () {
		var email = $("#formEmail").val().trim().toLowerCase();
		var manual = $("#accountMethod").val() === "manual";
		var pw = $("#formPassword").val(), confirmation = $("#formPasswordConfirm").val();
		var $err = $("#formError").addClass("d-none");
		$("#formSuccess").addClass("d-none");
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $err.text("Correo inválido.").removeClass("d-none"); return; }
		var existing = users.filter(function (u) { return (u.email || "").toLowerCase() === email; })[0];
		if (manual && existing) { $err.text("La cuenta ya existe. Usa Establecer contraseña en su fila.").removeClass("d-none"); return; }
		var validation = manual ? passwordError(pw, confirmation) : null;
		if (validation) { $err.text(validation).removeClass("d-none"); return; }
		var $btn = $(this).prop("disabled", true).text("Guardando…");
		invokeAdmin(manual ? { action: "create_user", email: email, password: pw, passwordConfirmation: confirmation }
			: { action: "invite", email: email, redirectTo: REDIRECT_TO }).then(function (data) {
			$("#formPassword, #formPasswordConfirm").val("");
			if (!manual) requireDelivery(data);
			$("#formEmail").val("");
			$("#formSuccess").text(manual ? "Cuenta creada. Asígnala al cliente en Clientes y Agencias." : "Invitación enviada.").removeClass("d-none");
		}).catch(function (err) {
			$err.text(err.message || "No se pudo guardar.").removeClass("d-none");
		}).finally(function () {
			$("#formPassword, #formPasswordConfirm").val("");
			$btn.prop("disabled", false).text(manual ? "Crear cuenta" : "Enviar invitación");
			loadData();
			$(document).trigger("apache360:users-changed");
		});
	});
	var passwordTargetId = null;
	var passwordModalEl = document.getElementById("passwordModal");
	$(document).on("click", ".set-password-btn", function (e) {
		e.preventDefault();
		passwordTargetId = $(this).data("id");
		$("#adminPasswordForm")[0].reset();
		$("#passwordFormError").addClass("d-none").text("");
		$("#passwordTargetEmail").text($(this).data("email"));
		bootstrap.Modal.getOrCreateInstance(passwordModalEl).show();
	});
	$(passwordModalEl).on("hidden.bs.modal", function () {
		passwordTargetId = null;
		$("#adminPasswordForm")[0].reset();
		$("#passwordTargetEmail").text("");
	});
	$("#adminPasswordForm").on("submit", function (e) {
		e.preventDefault();
		var pw = $("#adminNewPassword").val(), confirmation = $("#adminConfirmPassword").val();
		var validation = passwordError(pw, confirmation);
		if (!passwordTargetId || !$("#confirmPasswordChange").prop("checked")) return;
		if (validation) { $("#passwordFormError").text(validation).removeClass("d-none"); return; }
		$("#passwordFormError").addClass("d-none");
		$("#savePasswordBtn").prop("disabled", true).text("Guardando…");
		invokeAdmin({ action: "set_password", userId: passwordTargetId, password: pw, passwordConfirmation: confirmation }).then(function () {
			bootstrap.Modal.getOrCreateInstance(passwordModalEl).hide();
			$("#formSuccess").text("Contraseña guardada. La cuenta puede entrar con su correo y la nueva contraseña.").removeClass("d-none");
			loadData();
			$(document).trigger("apache360:users-changed");
		}).catch(function (err) {
			$("#passwordFormError").text(err.message || "No se pudo guardar.").removeClass("d-none");
		}).finally(function () {
			$("#adminNewPassword, #adminConfirmPassword").val("");
			$("#savePasswordBtn").prop("disabled", false).text("Guardar contraseña");
		});
	});

	$(document).on("click", ".send-reset-btn, .resend-invite-btn", function (e) {
		e.preventDefault();
		var email = $(this).data("email");
		var action = $(this).hasClass("send-reset-btn") ? "reset_password" : "invite";
		invokeAdmin({ action: action, email: email, redirectTo: REDIRECT_TO }).then(requireDelivery).then(function () {
			$("#formError").addClass("d-none");
			$("#formSuccess").text("Correo enviado a " + email).removeClass("d-none");
		}).catch(function (err) {
			$("#formSuccess").addClass("d-none");
			$("#formError").text(err.message).removeClass("d-none");
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
		// Borra también client_members/agency_members: antes solo se borraban
		// account_assignments/user_roles, así que un viewer o manager revocado
		// conservaba su acceso real a clientes/cuentas vía esas tablas.
		Promise.all([
			supabase.from("account_assignments").delete().eq("user_id", uid),
			supabase.from("user_roles").delete().eq("user_id", uid),
			supabase.from("client_members").delete().eq("user_id", uid),
			supabase.from("agency_members").delete().eq("user_id", uid),
		]).then(function (results) {
			var failed = results.filter(function (r) { return r.error; });
			if (failed.length) {
				alert("No se pudo revocar completamente el acceso: " + failed.map(function (r) { return r.error.message; }).join("; "));
			}
			loadData();
		});
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
