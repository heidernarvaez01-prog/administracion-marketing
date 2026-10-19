/**
 * Menú lateral único de Apache 360: reemplaza el contenido de #menu en todas
 * las páginas de producto, para que no se desalineen. Debe cargarse ANTES de
 * js/custom.min.js (que inicializa metisMenu sobre #menu).
 * data-require-role="admin" es cosmético (role-ui.js lo revela al admin);
 * la seguridad real es RLS + data-page-access.
 */
(function () {
	"use strict";
	var menu = document.getElementById("menu");
	if (!menu) return;

	var wrapper = document.getElementById("main-wrapper");
	var control = document.querySelector(".nav-control");
	if (wrapper && control) {
		wrapper.classList.add("apache-shell");
		wrapper.classList.remove("right-profile", "menu-toggle");
		control.setAttribute("role", "button");
		control.setAttribute("tabindex", "0");
		control.setAttribute("aria-controls", "menu");
		function setMenuOpen(open) {
			wrapper.classList.toggle("apache-menu-open", open);
			control.setAttribute("aria-expanded", String(open));
			control.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
			control.setAttribute("title", open ? "Cerrar menú" : "Abrir menú");
			var hamburger = control.querySelector(".hamburger");
			if (hamburger) hamburger.classList.toggle("is-active", open);
		}
		function toggleMenu(event) {
			event.preventDefault();
			event.stopImmediatePropagation();
			setMenuOpen(!wrapper.classList.contains("apache-menu-open"));
		}
		setMenuOpen(false);
		control.addEventListener("click", toggleMenu, true);
		control.addEventListener("keydown", function (event) {
			if (event.key === "Enter" || event.key === " ") toggleMenu(event);
		});
		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape") setMenuOpen(false);
		});
		document.addEventListener("click", function (event) {
			if (!control.contains(event.target) && !menu.closest(".deznav").contains(event.target)) setMenuOpen(false);
		});
	}

	var profile = document.querySelector(".header-profile");
	if (profile) {
		var trigger = profile.querySelector("a.nav-link");
		if (trigger) {
			trigger.setAttribute("aria-label", "Perfil y sesión");
			trigger.setAttribute("title", "Perfil y sesión");
			var photo = trigger.querySelector("img");
			if (photo) {
				var icon = document.createElement("i");
				icon.className = "fa fa-user-circle apache-profile-icon";
				icon.setAttribute("aria-hidden", "true");
				photo.replaceWith(icon);
			}
		}
		profile.querySelectorAll('.dropdown-menu a:not(#logoutLink)').forEach(function (link) { link.remove(); });
		var logout = profile.querySelector("#logoutLink");
		if (logout) logout.addEventListener("click", function (event) {
			if (typeof AuditClient === "undefined") return;
			event.preventDefault();
			event.stopImmediatePropagation();
			AuditClient.signOut();
		}, true);
	}

	var SECTIONS = [
		{ label: "Resultados", icon: "flaticon-381-networking", items: [
			{ href: "index.html", text: "Dashboard" },
			{ href: "compaign.html", text: "Campañas" },
			{ href: "calendario.html", text: "Calendario", admin: true },
		] },
		{ label: "Clientes", icon: "flaticon-381-user-9", items: [
			{ href: "clientes.html", text: "Clientes" },
			{ href: "alertas.html", text: "Alertas", admin: true },
			{ href: "auditoria.html", text: "Auditoría", admin: true },
		] },
		{ label: "Inteligencia", icon: "flaticon-381-idea", admin: true, items: [
			{ href: "preguntar-ia.html", text: "Preguntar a la IA" },
			{ href: "reporte-semanal.html", text: "Reporte semanal" },
			{ href: "clusters.html", text: "Clusters" },
			{ href: "brief.html", text: "Brief de marca" },
		] },
		{ label: "Administración", icon: "flaticon-381-settings-2", admin: true, href: "admin.html" },
	];

	var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
	if (page === "analytics.html") page = "index.html";

	function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

	var html = SECTIONS.map(function (s) {
		var role = s.admin ? ' data-require-role="admin"' : "";
		var head = '<i class="' + s.icon + '"></i><span class="nav-text">' + esc(s.label) + "</span>";
		if (s.href) {
			var act = s.href === page ? ' class="mm-active"' : "";
			return "<li" + role + act + '><a class="ai-icon" href="' + s.href + '" aria-expanded="false">' + head + "</a></li>";
		}
		var open = s.items.some(function (it) { return it.href === page; });
		var items = s.items.map(function (it) {
			var r = it.admin ? ' data-require-role="admin"' : "";
			var a = it.href === page ? ' class="mm-active"' : "";
			return "<li" + r + a + '><a href="' + it.href + '"' + (it.href === page ? ' class="mm-active"' : "") + ">" + esc(it.text) + "</a></li>";
		}).join("");
		return "<li" + role + (open ? ' class="mm-active"' : "") + '><a class="has-arrow ai-icon" href="javascript:void(0)" aria-expanded="' + open + '">' + head + "</a>" +
			'<ul aria-expanded="' + open + '">' + items + "</ul></li>";
	}).join("");
	menu.innerHTML = html;
})();
