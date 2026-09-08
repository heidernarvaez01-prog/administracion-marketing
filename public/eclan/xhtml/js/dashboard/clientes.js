(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;

	var $loading = $("#clientsLoading");
	var $empty = $("#clientsEmpty");
	var $grid = $("#clientsGrid");
	var $migrationPending = $("#migrationPending");
	var $authRequired = $("#authRequired");

	var $clientModal = $("#clientModal");
	var clientModalEl = document.getElementById("clientModal");
	var deleteModalEl = document.getElementById("deleteClientModal");
	var $clientForm = $("#clientForm");
	var $clientFormError = $("#clientFormError");
	var deleteTargetId = null;

	function showOnly($el) {
		$loading.addClass("d-none");
		$empty.addClass("d-none");
		$grid.addClass("d-none");
		$migrationPending.addClass("d-none");
		if ($el) $el.removeClass("d-none");
	}

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	function initials(name) {
		var parts = String(name || "").trim().split(/\s+/).slice(0, 2);
		var letters = parts.map(function (w) { return (w[0] || "").toUpperCase(); }).join("");
		return letters || "·";
	}

	var ACCENTS = ["bg-primary", "bg-info", "bg-success", "bg-secondary", "bg-warning", "bg-danger"];

	function renderClients(clients) {
		if (!clients.length) {
			showOnly($empty);
			return;
		}
		var html = clients.map(function (c, idx) {
			var accent = ACCENTS[idx % ACCENTS.length];
			var desc = c.description
				? '<p class="text-muted fs-13 mb-0 text-ov">' + escapeHtml(c.description) + "</p>"
				: '<p class="text-muted fs-13 mb-0 fst-italic">Sin descripción</p>';
			return (
				'<div class="col-xl-4 col-lg-6 col-md-6">' +
				'<div class="card">' +
				'<div class="card-body">' +
				'<div class="d-flex align-items-start">' +
				'<span class="' + accent + ' text-white rounded d-flex align-items-center justify-content-center me-3 fw-bold" style="width:44px;height:44px;flex:none;">' +
				escapeHtml(initials(c.name)) +
				"</span>" +
				'<div class="flex-grow-1 min-w-0">' +
				'<h5 class="mb-1 text-ov">' + escapeHtml(c.name) + "</h5>" +
				desc +
				"</div>" +
				'<div class="dropdown ms-2">' +
				'<a href="javascript:;" data-bs-toggle="dropdown"><i class="fa fa-ellipsis-v"></i></a>' +
				'<div class="dropdown-menu dropdown-menu-end">' +
				'<a href="javascript:;" class="dropdown-item edit-client-btn" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '" data-description="' + escapeHtml(c.description || "") + '"><i class="fa fa-pencil me-2"></i>Editar</a>' +
				'<a href="javascript:;" class="dropdown-item text-danger delete-client-btn" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '"><i class="fa fa-trash me-2"></i>Eliminar</a>' +
				"</div>" +
				"</div>" +
				"</div>" +
				"</div>" +
				"</div>" +
				"</div>"
			);
		}).join("");
		$grid.html(html);
		showOnly($grid);
	}

	function loadClients() {
		showOnly($loading);
		return supabase
			.from("audit_clients")
			.select("*")
			.order("created_at", { ascending: true })
			.then(function (res) {
				if (res.error) {
					// 42P01/PGRST205 = la tabla no existe todavía (migración pendiente)
					$migrationPending.removeClass("d-none");
					$loading.addClass("d-none");
					$empty.addClass("d-none");
					$grid.addClass("d-none");
					return;
				}
				renderClients(res.data || []);
			});
	}

	function openCreateModal() {
		$clientForm[0].reset();
		$("#clientId").val("");
		$("#clientModalTitle").text("Nuevo cliente");
		$clientFormError.addClass("d-none");
	}

	function openEditModal(id, name, description) {
		$("#clientId").val(id);
		$("#clientName").val(name);
		$("#clientDescription").val(description);
		$("#clientModalTitle").text("Editar cliente");
		$clientFormError.addClass("d-none");
		var modal = bootstrap.Modal.getOrCreateInstance(clientModalEl);
		modal.show();
	}

	function saveClient() {
		var id = $("#clientId").val();
		var name = $("#clientName").val().trim();
		var description = $("#clientDescription").val().trim();

		if (!name) {
			$clientFormError.text("El nombre del cliente es obligatorio.").removeClass("d-none");
			return;
		}

		var query;
		if (id) {
			query = supabase.from("audit_clients").update({ name: name, description: description || null }).eq("id", id);
		} else {
			query = supabase.auth.getUser().then(function (userRes) {
				var userId = userRes.data && userRes.data.user && userRes.data.user.id;
				return supabase.from("audit_clients").insert({ user_id: userId, name: name, description: description || null });
			});
		}

		Promise.resolve(query).then(function (res) {
			if (res.error) {
				$clientFormError.text("Error al guardar el cliente.").removeClass("d-none");
				return;
			}
			bootstrap.Modal.getOrCreateInstance(clientModalEl).hide();
			loadClients();
		});
	}

	function deleteClient() {
		if (!deleteTargetId) return;
		supabase.from("audit_clients").delete().eq("id", deleteTargetId).then(function () {
			bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
			deleteTargetId = null;
			loadClients();
		});
	}

	// --- Eventos ---
	$("#newClientBtn").on("click", openCreateModal);
	$("#retryLoadBtn").on("click", loadClients);
	$("#clientFormSubmit").on("click", saveClient);
	$("#confirmDeleteBtn").on("click", deleteClient);

	$(document).on("click", ".edit-client-btn", function () {
		openEditModal($(this).data("id"), $(this).data("name"), $(this).data("description"));
	});
	$(document).on("click", ".delete-client-btn", function () {
		deleteTargetId = $(this).data("id");
		$("#deleteClientName").text($(this).data("name"));
		bootstrap.Modal.getOrCreateInstance(deleteModalEl).show();
	});
	$("#logoutLink").on("click", function (e) {
		e.preventDefault();
		AuditClient.signOut();
	});

	// --- Arranque: sólo cargar si hay sesión ---
	AuditClient.getSession().then(function (session) {
		if (!session) {
			showOnly($authRequired);
			window.location.replace("page-login.html");
			return;
		}
		loadClients();
	});
})(jQuery);
