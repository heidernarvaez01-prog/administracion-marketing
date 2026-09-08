(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;
	var clientId = new URLSearchParams(window.location.search).get("client_id");

	var SECTIONS = [
		{ title: "Identificación", fields: [
			{ key: "marca", label: "Marca" },
			{ key: "sitio_web", label: "Sitio web", type: "url" },
			{ key: "mercado_objetivo", label: "País o mercado objetivo", hint: "Solo áreas geográficas" },
			{ key: "presupuesto_campana", label: "Presupuesto de campaña", type: "number" },
		]},
		{ title: "Estrategia", fields: [
			{ key: "necesidad_principal", label: "Necesidad principal", hint: "El problema a enfrentar y resolver con marketing", type: "textarea", rows: 3 },
			{ key: "descripcion_proyecto", label: "Descripción del proyecto", hint: "Qué ofrece la empresa, beneficios, audiencia y diferenciadores", type: "textarea", rows: 5 },
			{ key: "publico_objetivo", label: "Público objetivo y buyer persona", hint: "Tipos de personas y descripciones situacionales", type: "textarea", rows: 5 },
			{ key: "fundamentos_marca", label: "Fundamentos de marca", hint: "Productos, servicios y elementos obligatorios de marca", type: "textarea", rows: 4 },
		]},
		{ title: "Identidad verbal", fields: [
			{ key: "palabras_marca", label: "30 palabras que representan la marca", hint: "Separadas por comas", type: "textarea", rows: 3 },
			{ key: "frases_marca", label: "10 frases que describen la marca", hint: "Una por línea", type: "textarea", rows: 5 },
			{ key: "valores_marca", label: "Valores de marca", hint: "Con una explicación para cada uno", type: "textarea", rows: 4 },
			{ key: "promesa_marca", label: "Promesa de marca", hint: "Promesas racionales y emocionales alcanzables", type: "textarea", rows: 3 },
			{ key: "reasons_why", label: "Reasons Why / Razones para creer", hint: "Razones concretas para creer la promesa", type: "textarea", rows: 3 },
		]},
		{ title: "Personalidad", fields: [
			{ key: "personalidad_marca", label: "Personalidad de marca", hint: "Arquetipo si aplica", type: "textarea", rows: 3 },
			{ key: "estilo_tono", label: "Estilo y tono", hint: "Cómo habla la marca según cliente y canal", type: "textarea", rows: 3 },
			{ key: "diferenciador", label: "Diferenciador principal", hint: "Lo que nadie más tiene en el mercado local", type: "textarea", rows: 3 },
		]},
		{ title: "Creatividad y referencias", fields: [
			{ key: "insights", label: "Hallazgos o insights útiles", hint: "Conceptos, campañas, slogans y aprendizajes previos", type: "textarea", rows: 4 },
			{ key: "elementos_marca", label: "Elementos de marca", hint: "Colores, tipografía, lineamientos gráficos y manuales", type: "textarea", rows: 4 },
			{ key: "benchmark", label: "Benchmark / Referencias", hint: "Competidores relevantes a analizar", type: "textarea", rows: 4 },
		]},
	];
	var ALL_KEYS = SECTIONS.reduce(function (acc, s) { return acc.concat(s.fields.map(function (f) { return f.key; })); }, []);

	var $loading = $("#briefLoading");
	var $content = $("#briefContent");
	var $migrationPending = $("#migrationPending");
	var $authRequired = $("#authRequired");
	var $clientNotFound = $("#clientNotFound");

	function showOnly($el) {
		[$loading, $content, $migrationPending, $authRequired, $clientNotFound].forEach(function ($x) { $x.addClass("d-none"); });
		if ($el) $el.removeClass("d-none");
	}

	function buildAccordion() {
		var html = SECTIONS.map(function (section, idx) {
			var collapseId = "briefSection" + idx;
			var fieldsHtml = section.fields.map(function (f) {
				var hint = f.hint ? '<p class="fs-12 text-muted mb-1">' + f.hint + "</p>" : "";
				var input;
				if (f.type === "textarea") {
					input = '<textarea class="form-control brief-field" data-key="' + f.key + '" rows="' + (f.rows || 3) + '" maxlength="4000"></textarea>';
				} else if (f.type === "number") {
					input = '<input type="number" min="0" step="0.01" class="form-control brief-field" data-key="' + f.key + '">';
				} else {
					input = '<input type="' + (f.type === "url" ? "url" : "text") + '" class="form-control brief-field" data-key="' + f.key + '" maxlength="500">';
				}
				return '<div class="form-group mb-3"><label class="form-label">' + f.label + "</label>" + hint + input + "</div>";
			}).join("");

			return (
				'<div class="card mb-2">' +
				'<div class="card-header" style="cursor:pointer;" data-bs-toggle="collapse" data-bs-target="#' + collapseId + '">' +
				'<h5 class="mb-0 fs-16">' + section.title + "</h5>" +
				"</div>" +
				'<div id="' + collapseId + '" class="collapse' + (idx === 0 ? " show" : "") + '">' +
				'<div class="card-body">' + fieldsHtml + "</div>" +
				"</div></div>"
			);
		}).join("");
		$("#briefAccordion").html(html);
	}

	function updateProgress(brief) {
		var filled = ALL_KEYS.filter(function (k) {
			var v = brief[k];
			return v !== null && v !== undefined && String(v).trim() !== "";
		}).length;
		var pct = Math.round((filled / ALL_KEYS.length) * 100);
		$("#briefProgressBar").css("width", pct + "%").removeClass("bg-primary bg-warning bg-success")
			.addClass(pct >= 80 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-primary");
		$("#briefProgressLabel").text(filled + "/" + ALL_KEYS.length + " campos · " + (pct >= 80 ? "Completo" : pct >= 40 ? "En progreso" : "Recién empezado"));
	}

	function fillForm(brief) {
		ALL_KEYS.forEach(function (k) {
			$('.brief-field[data-key="' + k + '"]').val(brief[k] != null ? brief[k] : "");
		});
		updateProgress(brief);
	}

	function readForm() {
		var brief = {};
		$(".brief-field").each(function () {
			var $f = $(this);
			var key = $f.data("key");
			var val = $f.val();
			brief[key] = val === "" ? null : val;
		});
		return brief;
	}

	var saveTimer = null;
	function scheduleSave() {
		$("#saveStatus").html('<i class="fa fa-circle-o-notch fa-spin me-1"></i>Guardando…');
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(saveNow, 1200);
	}

	function saveNow() {
		if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
		var brief = readForm();
		updateProgress(brief);
		supabase.auth.getUser().then(function (userRes) {
			var userId = userRes.data && userRes.data.user && userRes.data.user.id;
			var payload = Object.assign({}, brief, { client_id: clientId, user_id: userId });
			return supabase.from("brand_briefs").upsert(payload, { onConflict: "client_id" });
		}).then(function (res) {
			if (res.error) $("#saveStatus").html('<span class="text-danger"><i class="fa fa-exclamation-circle me-1"></i>Error al guardar</span>');
			else $("#saveStatus").html('<span class="text-success"><i class="fa fa-check me-1"></i>Guardado</span>');
		});
	}

	$("#saveBriefBtn").on("click", saveNow);
	$(document).on("input change", ".brief-field", scheduleSave);
	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	if (!clientId) {
		showOnly($clientNotFound);
	} else {
		AuditClient.getSession().then(function (session) {
			if (!session) { showOnly($authRequired); window.location.replace("page-login.html"); return; }
			showOnly($loading);
			supabase.from("audit_clients").select("id, name").eq("id", clientId).maybeSingle()
				.then(function (res) {
					if (res.error) { showOnly($migrationPending); return; }
					if (!res.data) { showOnly($clientNotFound); return; }
					$("#clientTitle").text(res.data.name + " — Brief de marca");
					buildAccordion();
					return supabase.from("brand_briefs").select("*").eq("client_id", clientId).maybeSingle();
				})
				.then(function (res) {
					if (!res) return;
					fillForm(res.data || {});
					showOnly($content);
				});
		});
	}
})(jQuery);
