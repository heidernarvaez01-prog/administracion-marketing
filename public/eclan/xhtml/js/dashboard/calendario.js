(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;

	var $loading = $("#calendarLoading");
	var $content = $("#calendarContent");
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

	var calendar = null;
	var clients = [];
	var records = [];

	function statusClass(rec) {
		var today = new Date().toISOString().slice(0, 10);
		if (rec.fecha_fin && rec.fecha_fin < today) return "bg-secondary";
		if (rec.fecha_inicio && rec.fecha_inicio > today) return "bg-info";
		return "bg-success";
	}

	function nextDay(dateStr) {
		var d = new Date(dateStr + "T00:00:00Z");
		d.setUTCDate(d.getUTCDate() + 1);
		return d.toISOString().slice(0, 10);
	}

	function buildEvents(clientId) {
		var clientsById = {};
		clients.forEach(function (c) { clientsById[c.id] = c; });
		return records
			.filter(function (r) { return r.fecha_inicio && r.fecha_fin && (!clientId || r.client_id === clientId); })
			.map(function (r) {
				var client = clientsById[r.client_id];
				return {
					title: (client ? client.name + " · " : "") + r.campaign_name,
					start: r.fecha_inicio,
					end: nextDay(r.fecha_fin), // FullCalendar's `end` is exclusive
					allDay: true,
					className: statusClass(r),
				};
			});
	}

	function renderCalendar(clientId) {
		var events = buildEvents(clientId);
		$("#calendarEmpty").toggleClass("d-none", events.length > 0);
		if (calendar) {
			calendar.removeAllEvents();
			events.forEach(function (e) { calendar.addEvent(e); });
			return;
		}
		var el = document.getElementById("calendar");
		calendar = new FullCalendar.Calendar(el, {
			initialView: "dayGridMonth",
			headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,listMonth" },
			height: "auto",
			events: events,
		});
		calendar.render();
	}

	function loadAndRender() {
		return supabase.from("audit_clients").select("id, name").then(function (clientsRes) {
			clients = clientsRes.data || [];
			$("#calendarClientFilter").html(
				'<option value="">Todos los clientes</option>' +
				clients.map(function (c) { return '<option value="' + c.id + '">' + escapeHtml(c.name) + "</option>"; }).join("")
			);
			return supabase.from("audit_records").select("*");
		}).then(function (recordsRes) {
			records = recordsRes.data || [];
			renderCalendar("");
		});
	}

	$("#calendarClientFilter").on("change", function () {
		renderCalendar($(this).val());
	});

	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	AuditClient.getSession().then(function (session) {
		if (!session) { showOnly($authRequired); window.location.replace("page-login.html"); return; }
		showOnly($loading);
		supabase.from("audit_clients").select("id").limit(1).then(function (res) {
			if (res.error) { showOnly($migrationPending); return; }
			return loadAndRender().then(function () { showOnly($content); });
		}).catch(function (err) { console.error(err); });
	});
})(jQuery);
