/**
 * Tab "Clientes y Agencias" de admin.html — modelo de 3 niveles:
 * super admin -> agencias (agency_members, rol 'manager') -> clientes
 * (audit_clients.agency_id) con viewers (client_members, rol 'viewer' fijo).
 *
 * Seguridad (XSS): ningún dato de la base (nombres/descripciones de
 * audit_clients, correos, nombres de ad_accounts/agencias) se inserta con
 * .html()/innerHTML ni concatenación de strings en HTML. Todo se arma vía
 * DOM (createElement) + .textContent, y los identificadores viajan por
 * closure en vez de data-id + delegación — no hay nada que escapar porque
 * nunca se construye HTML a partir de esos valores.
 *
 * No toca admin.js (el tab "Equipo" sigue siendo exactamente el mismo
 * código) ni el sidebar.
 */
(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;
	var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	var CURRENCY_RE = /^[A-Z]{3}$/;
	var REDIRECT_TO = window.location.origin + "/eclan/xhtml/page-login.html"; // mismo que admin.js

	var currentUserId = null;
	var firstLoad = true;
	var agencies = [], agencyMembers = [], clients = [], accounts = [], clientAccounts = [], clientMembers = [], users = [];

	var $loading = $("#clientsAgenciesLoading");
	var $content = $("#clientsAgenciesContent");
	var $formError = $("#caFormError");

	function showCA($el) {
		$loading.addClass("d-none");
		if ($el) $el.removeClass("d-none");
	}

	function setError(msg) {
		if (msg) $formError.text(msg).removeClass("d-none");
		else $formError.addClass("d-none");
	}

	// --- Helpers de construcción de DOM (sin innerHTML en ningún caso) ---
	function el(tag, cls) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		return e;
	}
	function textEl(tag, cls, text) {
		var e = el(tag, cls);
		e.textContent = text == null ? "" : String(text);
		return e;
	}
	function icon(cls) { return el("i", cls); }

	function chip(label, onRemove) {
		var span = el("span", "ca-chip");
		span.appendChild(document.createTextNode(label));
		var btn = el("button", "ca-chip-remove");
		btn.type = "button";
		btn.title = "Quitar";
		btn.appendChild(icon("fa fa-times"));
		btn.addEventListener("click", onRemove);
		span.appendChild(btn);
		return span;
	}

	// --- Lookups ---
	function emailById(uid) {
		var u = users.filter(function (x) { return x.id === uid; })[0];
		return u ? u.email : uid;
	}
	function accountById(id) {
		return accounts.filter(function (a) { return a.account_id === id; })[0];
	}
	function clientsByAgency(agencyId) {
		return clients.filter(function (c) { return c.agency_id === agencyId; });
	}
	function managersByAgency(agencyId) {
		return agencyMembers.filter(function (m) { return m.agency_id === agencyId; });
	}
	function accountsByClient(clientId) {
		return clientAccounts.filter(function (ca) { return ca.client_id === clientId; });
	}
	function viewersByClient(clientId) {
		return clientMembers.filter(function (m) { return m.client_id === clientId; });
	}
	function attachedAccountIds() {
		return clientAccounts.map(function (ca) { return ca.account_id; });
	}
	function availableAccounts() {
		var attached = attachedAccountIds();
		return accounts.filter(function (a) { return attached.indexOf(a.account_id) === -1; });
	}
	function accountAgencyLabel(acc) {
		return acc.managed_by === "own" ? "ApacheStudio" : (acc.agency_name || "otra agencia");
	}

	// --- Modal genérico de confirmación: un solo handler, botón deshabilitado mientras corre ---
	var confirmModalEl = document.getElementById("confirmActionModal");
	var $confirmBtn = $("#confirmActionBtn");
	var $confirmTitle = $("#confirmActionTitle");
	var $confirmBody = $("#confirmActionBody");

	function showConfirm(title, body, onConfirm) {
		$confirmTitle.text(title);
		$confirmBody.text(body);
		$confirmBtn.off("click").on("click", function () {
			$confirmBtn.prop("disabled", true);
			Promise.resolve().then(onConfirm).then(function () {
				bootstrap.Modal.getOrCreateInstance(confirmModalEl).hide();
			}).catch(function (err) {
				setError((err && err.message) || "Error inesperado.");
			}).then(function () {
				$confirmBtn.prop("disabled", false);
			});
		});
		bootstrap.Modal.getOrCreateInstance(confirmModalEl).show();
	}

	// --- Invitar-si-no-existe (maneja alreadyMember sin userId, igual que admin.js) ---
	function resolveOrInviteUser(rawEmail) {
		var email = String(rawEmail || "").trim().toLowerCase();
		if (!EMAIL_RE.test(email)) return Promise.reject(new Error("Correo inválido"));
		var existing = users.filter(function (u) { return (u.email || "").toLowerCase() === email; })[0];
		if (existing) return Promise.resolve(existing.id);

		return supabase.functions.invoke("admin-users", { body: { action: "invite", email: email, redirectTo: REDIRECT_TO } })
			.then(function (res) {
				if (res.error || (res.data && res.data.error)) {
					throw new Error((res.error && res.error.message) || (res.data && res.data.error) || "No se pudo invitar");
				}
				var uid = res.data && res.data.userId;
				if (uid) return uid;
				// alreadyMember:true (u otra respuesta sin userId) -> refrescar lista y buscar por correo.
				return supabase.functions.invoke("admin-users").then(function (res2) {
					users = (res2.data && res2.data.users) || users;
					var found = users.filter(function (u) { return (u.email || "").toLowerCase() === email; })[0];
					if (!found) throw new Error("No se pudo identificar al usuario después de invitarlo");
					return found.id;
				});
			});
	}

	// --- Mutaciones (recargan todo tras cada una, igual que el resto de Eclan) ---
	function loadAll() {
		if (firstLoad) showCA(null);
		return Promise.all([
			supabase.from("agencies").select("id,name").order("name"),
			supabase.from("agency_members").select("agency_id,user_id"),
			supabase.from("audit_clients").select("id,name,description,agency_id").order("name"),
			supabase.from("ad_accounts").select("account_id,account_name,managed_by,agency_name,currency,active").order("account_name"),
			supabase.from("client_accounts").select("client_id,account_id"),
			supabase.from("client_members").select("client_id,user_id,role"),
			supabase.functions.invoke("admin-users"),
		]).then(function (results) {
			agencies = results[0].data || [];
			agencyMembers = results[1].data || [];
			clients = results[2].data || [];
			accounts = results[3].data || [];
			clientAccounts = results[4].data || [];
			clientMembers = (results[5].data || []).filter(function (m) { return m.role === "viewer"; });
			users = (results[6].data && results[6].data.users) || [];
			render();
			if (firstLoad) { showCA($content); firstLoad = false; }
		});
	}

	function createClient(name, description, agencyId) {
		return supabase.from("audit_clients").insert({
			user_id: currentUserId, name: name, description: description || null, agency_id: agencyId,
		}).then(function (res) {
			if (res.error) throw new Error(res.error.message);
			return loadAll();
		});
	}

	function doAttach(clientId, accountId) {
		return supabase.from("client_accounts").insert({ client_id: clientId, account_id: accountId }).then(function (res) {
			if (res.error) throw new Error(res.error.message);
			return loadAll();
		});
	}

	function doDetach(clientId, accountId) {
		return supabase.from("client_accounts").delete().eq("client_id", clientId).eq("account_id", accountId).then(function (res) {
			if (res.error) throw new Error(res.error.message);
			return loadAll();
		});
	}

	function saveCurrency(accountId, rawValue) {
		var value = String(rawValue || "").trim().toUpperCase();
		if (value && !CURRENCY_RE.test(value)) { setError("Moneda inválida. Usa 3 letras, ej. USD."); return; }
		setError(null);
		var current = accountById(accountId);
		var finalValue = value || null;
		if (current && current.currency === finalValue) return;
		supabase.from("ad_accounts").update({ currency: finalValue }).eq("account_id", accountId).then(function (res) {
			if (res.error) { setError("Error al guardar la moneda."); return; }
			loadAll();
		});
	}

	function removeManager(agencyId, userId) {
		supabase.from("agency_members").delete().eq("agency_id", agencyId).eq("user_id", userId).then(function (res) {
			if (res.error) { setError("Error al quitar el manager."); return; }
			loadAll();
		});
	}

	function removeViewer(clientId, userId) {
		supabase.from("client_members").delete().eq("client_id", clientId).eq("user_id", userId).then(function (res) {
			if (res.error) { setError("Error al quitar el viewer."); return; }
			loadAll();
		});
	}

	// --- Acciones que piden confirmación ---
	function requestAttach(client, agency, accountId) {
		var acc = accountById(accountId);
		if (!acc) return;
		var accLabel = acc.account_name || acc.account_id;
		var accAgency = accountAgencyLabel(acc);
		var clientAgency = agency.name;
		if (accAgency !== clientAgency) {
			showConfirm(
				"¿Adjuntar \"" + accLabel + "\" a " + client.name + "?",
				"Esta cuenta es operada por " + accAgency + ", pero " + client.name + " pertenece a " + clientAgency +
					". Los managers de " + clientAgency + " podrán ver esta cuenta de " + accAgency + ".",
				function () { return doAttach(client.id, accountId); }
			);
		} else {
			doAttach(client.id, accountId).catch(function (err) { setError(err.message); });
		}
	}

	function requestDetach(client, acc) {
		var label = acc.account_name || acc.account_id;
		showConfirm(
			"¿Quitar \"" + label + "\" de " + client.name + "?",
			"Los viewers de " + client.name + " dejarán de ver esta cuenta de inmediato.",
			function () { return doDetach(client.id, acc.account_id); }
		);
	}

	function requestAddManager(agency, rawEmail) {
		var email = String(rawEmail || "").trim();
		if (!EMAIL_RE.test(email)) { setError("Correo inválido."); return; }
		setError(null);
		showConfirm(
			"¿Hacer a " + email + " manager de " + agency.name + "?",
			"Verá todos los clientes y cuentas de " + agency.name + ", y podrá añadir o quitar viewers en cualquiera de ellos.",
			function () {
				return resolveOrInviteUser(email).then(function (uid) {
					if (agencyMembers.some(function (m) { return m.agency_id === agency.id && m.user_id === uid; })) return;
					return supabase.from("agency_members").insert({ agency_id: agency.id, user_id: uid }).then(function (res) {
						if (res.error) throw new Error(res.error.message);
						return loadAll();
					});
				});
			}
		);
	}

	function requestAddViewer(client, rawEmail) {
		var email = String(rawEmail || "").trim();
		if (!EMAIL_RE.test(email)) { setError("Correo inválido."); return; }
		setError(null);
		showConfirm(
			"¿Dar acceso de viewer a " + email + "?",
			"Verá las cuentas y los datos de " + client.name + " únicamente.",
			function () {
				return resolveOrInviteUser(email).then(function (uid) {
					if (clientMembers.some(function (m) { return m.client_id === client.id && m.user_id === uid; })) return;
					return supabase.from("client_members").insert({ client_id: client.id, user_id: uid, role: "viewer" }).then(function (res) {
						if (res.error) throw new Error(res.error.message);
						return loadAll();
					});
				});
			}
		);
	}

	// --- Modal "nuevo cliente" ---
	function openNewClientModal(preselectAgencyId) {
		$("#newClientName").val("");
		$("#newClientDescription").val("");
		var $sel = $("#newClientAgency").empty();
		agencies.forEach(function (a) {
			var opt = document.createElement("option");
			opt.value = a.id;
			opt.textContent = a.name;
			$sel.append(opt);
		});
		if (preselectAgencyId) $sel.val(preselectAgencyId);
		$("#newClientFormError").addClass("d-none");
		bootstrap.Modal.getOrCreateInstance(document.getElementById("newClientModal")).show();
	}

	function submitNewClient() {
		var name = $("#newClientName").val().trim();
		var description = $("#newClientDescription").val().trim();
		var agencyId = $("#newClientAgency").val();
		if (!name) { $("#newClientFormError").text("El nombre del cliente es obligatorio.").removeClass("d-none"); return; }
		if (!agencyId) { $("#newClientFormError").text("Elige una agencia.").removeClass("d-none"); return; }
		createClient(name, description, agencyId).then(function () {
			bootstrap.Modal.getOrCreateInstance(document.getElementById("newClientModal")).hide();
		}).catch(function (err) {
			$("#newClientFormError").text(err.message || "Error al crear el cliente.").removeClass("d-none");
		});
	}
	$("#newClientSubmitBtn").on("click", submitNewClient);

	// --- Render ---
	function statTile(label, value, iconCls, bg) {
		var col = el("div", "col-6 col-md-3");
		var card = el("div", "card widget-stat");
		var body = el("div", "card-body p-3");
		var media = el("div", "media align-items-center");
		var mb = el("div", "media-body");
		mb.appendChild(textEl("p", "fs-13 mb-1", label));
		mb.appendChild(textEl("h3", "mb-0", String(value)));
		var iconSpan = el("span", "ms-3 " + bg + " text-white");
		iconSpan.appendChild(icon(iconCls));
		media.appendChild(mb);
		media.appendChild(iconSpan);
		body.appendChild(media);
		card.appendChild(body);
		col.appendChild(card);
		return col;
	}

	function renderStats() {
		var $row = $("#caStats").empty();
		$row.append(statTile("Agencias", agencies.length, "fa fa-building", "bg-primary"));
		$row.append(statTile("Clientes", clients.length, "fa fa-users", "bg-secondary"));
		$row.append(statTile("Cuentas adjuntas", clientAccounts.length, "fa fa-link", "bg-info"));
		var avail = availableAccounts().length;
		$row.append(statTile("Cuentas sin cliente", avail, avail > 0 ? "fa fa-exclamation-triangle" : "fa fa-check", avail > 0 ? "bg-warning" : "bg-success"));
	}

	function buildAccountSelect() {
		var select = el("select", "form-control form-control-sm mb-3");
		var placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.textContent = "Adjuntar cuenta…";
		select.appendChild(placeholder);
		availableAccounts().forEach(function (a) {
			var opt = document.createElement("option");
			opt.value = a.account_id;
			opt.textContent = (a.account_name || a.account_id) + " · " + accountAgencyLabel(a);
			select.appendChild(opt);
		});
		return select;
	}

	function renderAccountRow(client, agency, acc) {
		var row = el("div", "d-flex align-items-center gap-2 mb-1 ca-account-row");
		var nameWrap = el("div", "flex-grow-1 min-w-0");
		nameWrap.appendChild(textEl("div", "fs-12 fw-medium text-truncate", acc.account_name || acc.account_id));
		nameWrap.appendChild(textEl("div", "fs-10 text-muted font-mono-data", acc.account_id));
		row.appendChild(nameWrap);

		var opLabel = accountAgencyLabel(acc);
		row.appendChild(textEl("span", "badge " + (acc.managed_by === "own" ? "bg-secondary" : "bg-light text-dark") + " fs-10", opLabel));

		var curInput = el("input", "form-control form-control-sm ca-currency");
		curInput.type = "text";
		curInput.maxLength = 3;
		curInput.value = acc.currency || "";
		curInput.placeholder = "USD";
		curInput.addEventListener("input", function () {
			curInput.value = curInput.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
		});
		curInput.addEventListener("blur", function () { saveCurrency(acc.account_id, curInput.value); });
		row.appendChild(curInput);

		var removeBtn = el("button", "btn btn-sm btn-link text-danger p-0");
		removeBtn.type = "button";
		removeBtn.title = "Quitar cuenta";
		removeBtn.appendChild(icon("fa fa-times"));
		removeBtn.addEventListener("click", function () { requestDetach(client, acc); });
		row.appendChild(removeBtn);

		if (opLabel !== agency.name) {
			var warn = el("div", "ca-cross-warning mt-1 w-100");
			warn.appendChild(icon("fa fa-exclamation-triangle"));
			warn.appendChild(textEl("span", null, "Operada por " + opLabel + "; este cliente es de " + agency.name + "."));
			var wrap = el("div", "mb-2");
			wrap.appendChild(row);
			wrap.appendChild(warn);
			return wrap;
		}
		return row;
	}

	function renderClientCard(client, agency) {
		var col = el("div", "col-md-6");
		var inner = el("div", "card h-100 ca-client-card");
		var body = el("div", "card-body");

		body.appendChild(textEl("h5", "mb-1", client.name));
		body.appendChild(textEl("p", "fs-12 text-muted mb-3", client.description || "Sin descripción"));

		body.appendChild(textEl("div", "fs-11 text-uppercase text-muted fw-bold mb-1", "Cuentas"));
		var accs = accountsByClient(client.id);
		if (!accs.length) {
			body.appendChild(textEl("p", "fs-12 text-muted fst-italic mb-2", "Sin cuentas adjuntas."));
		} else {
			accs.forEach(function (ca) {
				var acc = accountById(ca.account_id);
				if (acc) body.appendChild(renderAccountRow(client, agency, acc));
			});
		}
		var attachSelect = buildAccountSelect();
		attachSelect.addEventListener("change", function () {
			var val = attachSelect.value;
			attachSelect.value = "";
			if (val) requestAttach(client, agency, val);
		});
		body.appendChild(attachSelect);

		body.appendChild(textEl("div", "fs-11 text-uppercase text-muted fw-bold mb-1", "Viewers"));
		var viewersWrap = el("div", "mb-2");
		var viewers = viewersByClient(client.id);
		if (!viewers.length) viewersWrap.appendChild(textEl("span", "fs-12 text-muted fst-italic", "Sin viewers todavía."));
		viewers.forEach(function (v) {
			viewersWrap.appendChild(chip(emailById(v.user_id), function () { removeViewer(client.id, v.user_id); }));
		});
		body.appendChild(viewersWrap);

		var viewerForm = el("div", "d-flex gap-1");
		var viewerInput = el("input", "form-control form-control-sm");
		viewerInput.type = "email";
		viewerInput.placeholder = "persona@correo.com";
		var viewerBtn = textEl("button", "btn btn-outline-secondary btn-sm", "Añadir");
		viewerBtn.type = "button";
		viewerBtn.addEventListener("click", function () { requestAddViewer(client, viewerInput.value); viewerInput.value = ""; });
		viewerInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); viewerBtn.click(); } });
		viewerForm.appendChild(viewerInput);
		viewerForm.appendChild(viewerBtn);
		body.appendChild(viewerForm);

		inner.appendChild(body);
		col.appendChild(inner);
		return col;
	}

	function renderAgencyCard(agency) {
		var card = el("div", "card mb-4 ca-agency-card");
		var head = el("div", "card-header d-flex align-items-center justify-content-between flex-wrap gap-2");

		var titleWrap = el("div");
		titleWrap.appendChild(textEl("h4", "card-title mb-0", agency.name));
		var agClients = clientsByAgency(agency.id);
		titleWrap.appendChild(textEl("p", "fs-12 text-muted mb-0", agClients.length + " cliente" + (agClients.length === 1 ? "" : "s")));
		head.appendChild(titleWrap);

		var managersWrap = el("div", "d-flex align-items-center flex-wrap gap-1");
		managersWrap.appendChild(textEl("span", "fs-12 text-muted me-1", "Managers"));
		managersByAgency(agency.id).forEach(function (m) {
			managersWrap.appendChild(chip(emailById(m.user_id), function () { removeManager(agency.id, m.user_id); }));
		});
		var mgrInput = el("input", "form-control form-control-sm");
		mgrInput.type = "email";
		mgrInput.style.width = "180px";
		mgrInput.style.display = "inline-block";
		mgrInput.placeholder = "correo@agencia.com";
		var mgrBtn = textEl("button", "btn btn-outline-secondary btn-sm", "Añadir manager");
		mgrBtn.type = "button";
		mgrBtn.addEventListener("click", function () { requestAddManager(agency, mgrInput.value); mgrInput.value = ""; });
		mgrInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); mgrBtn.click(); } });
		managersWrap.appendChild(mgrInput);
		managersWrap.appendChild(mgrBtn);
		head.appendChild(managersWrap);
		card.appendChild(head);

		var body = el("div", "card-body");
		var clientsHeadRow = el("div", "d-flex align-items-center justify-content-between mb-3");
		clientsHeadRow.appendChild(textEl("span", "fs-13 text-muted", "Clientes de " + agency.name));
		var newBtn = el("button", "btn btn-primary btn-sm");
		newBtn.type = "button";
		newBtn.appendChild(icon("fa fa-plus me-1"));
		newBtn.appendChild(document.createTextNode("Nuevo cliente"));
		newBtn.addEventListener("click", function () { openNewClientModal(agency.id); });
		clientsHeadRow.appendChild(newBtn);
		body.appendChild(clientsHeadRow);

		var grid = el("div", "row g-3");
		if (!agClients.length) {
			grid.appendChild(textEl("p", "text-muted fst-italic text-center py-3 col-12", "Aún no hay clientes en esta agencia."));
		} else {
			agClients.forEach(function (c) { grid.appendChild(renderClientCard(c, agency)); });
		}
		body.appendChild(grid);
		card.appendChild(body);
		return card;
	}

	function render() {
		renderStats();
		var $wrap = $("#caAgencies").empty();
		agencies.forEach(function (agency) { $wrap.append(renderAgencyCard(agency)); });
	}

	// --- Arranque: independiente del gate de admin.js, mismo criterio (si no
	// hay sesión o no es admin, simplemente no se carga — admin.js ya muestra
	// #authRequired/#notAdmin para toda la página). ---
	AuditClient.getSession().then(function (session) {
		if (!session) return;
		currentUserId = session.user.id;
		supabase.from("user_roles").select("role").eq("user_id", currentUserId).eq("role", "admin").maybeSingle()
			.then(function (res) {
				if (!res.data) return;
				loadAll();
			});
	});
})(jQuery);
