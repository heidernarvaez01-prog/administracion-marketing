(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined" || typeof ClusterLib === "undefined") return;
	var supabase = AuditClient.supabase;
	var SUPABASE_URL = "https://szdivobcbdkiszgrizic.supabase.co";
	var SUPABASE_ANON_KEY = "sb_publishable_ldumgPigulWT8adpCHpa_Q_dLVy4EC-";
	var clientId = new URLSearchParams(window.location.search).get("client_id");

	var $loading = $("#clustersLoading");
	var $content = $("#clustersContent");
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

	var runs = [];
	var runningKey = null;
	var elapsedTimer = null;
	var elapsed = 0;

	function runThisMonth(clusterKey) {
		var now = new Date();
		return runs.filter(function (r) {
			if (r.cluster_key !== clusterKey) return false;
			var d = new Date(r.created_at);
			return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
		})[0];
	}

	function nextMonthLabel() {
		var d = new Date();
		d.setMonth(d.getMonth() + 1, 1);
		return d.toLocaleDateString("es-CO", { month: "long", day: "numeric" });
	}

	function fmtDate(iso) {
		return new Date(iso).toLocaleString("es-CO", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
	}

	function renderCatalog(progressBySection) {
		$("#clusterCatalog").html(ClusterLib.CLUSTER_CATALOG.map(function (def) {
			var locked = !!runThisMonth(def.key);
			var isRunning = runningKey === def.key;
			var total = def.navLabels.length;
			var btnLabel = isRunning ? "Generando…" : locked ? "Próximo mes" : "Correr cluster";
			var btnIcon = isRunning ? "fa-spinner fa-spin" : locked ? "fa-lock" : "fa-magic";
			var progressHtml = "";
			if (isRunning) {
				var p = progressBySection || { section: 0, chars: 0 };
				var pct = Math.max(4, (p.section / total) * 100);
				var label = p.section === 0
					? "Analizando brief y datos de campaña…"
					: "Escribiendo " + def.navLabels[Math.min(p.section - 1, total - 1)] + " — sección " + Math.min(p.section, total) + " de " + total;
				var mm = Math.floor(elapsed / 60), ss = String(elapsed % 60).padStart(2, "0");
				progressHtml =
					'<div class="mt-3 pt-3 border-top">' +
					'<div class="d-flex justify-content-between fs-12 text-muted mb-1"><span>' + label + '</span><span class="font-monospace">' + mm + ":" + ss + "</span></div>" +
					'<div class="progress" style="height:6px;"><div class="progress-bar bg-primary" style="width:' + pct + '%"></div></div>' +
					'<p class="fs-12 text-muted mt-2 mb-0">Esto toma unos minutos — mantén esta pestaña abierta mientras la IA lo construye.</p>' +
					"</div>";
			} else if (locked) {
				progressHtml = '<p class="fs-12 text-muted mt-2 mb-0">Ya se generó este mes. Disponible de nuevo el ' + nextMonthLabel() + ".</p>";
			}

			return (
				'<div class="card mb-3"><div class="card-body">' +
				'<div class="d-flex flex-wrap justify-content-between align-items-start gap-3">' +
				'<div class="d-flex align-items-start gap-3">' +
				'<span class="bg-primary-light text-primary rounded d-flex align-items-center justify-content-center" style="width:40px;height:40px;flex:none;"><i class="fa fa-sitemap"></i></span>' +
				"<div>" +
				'<div class="d-flex align-items-center gap-2 flex-wrap">' +
				'<h5 class="mb-0">' + def.title + "</h5>" +
				'<span class="badge bg-light text-dark">' + def.badge + "</span>" +
				(locked ? '<span class="badge bg-light text-muted"><i class="fa fa-lock me-1"></i>Usado este mes</span>' : "") +
				"</div>" +
				'<p class="fs-13 text-muted mt-1 mb-0" style="max-width:640px;">' + escapeHtml(def.description) + "</p>" +
				"</div></div>" +
				'<button type="button" class="btn btn-primary run-cluster-btn shrink-0" data-key="' + def.key + '" ' + (runningKey || locked ? "disabled" : "") + '><i class="fa ' + btnIcon + ' me-2"></i>' + btnLabel + "</button>" +
				"</div>" + progressHtml +
				"</div></div>"
			);
		}).join(""));
	}

	function renderRuns() {
		$("#runsCount").text(runs.length);
		if (!runs.length) { $("#runsEmpty").removeClass("d-none"); $("#runsList").addClass("d-none"); return; }
		$("#runsEmpty").addClass("d-none");
		$("#runsList").removeClass("d-none").html(runs.map(function (r) {
			return (
				'<div class="d-flex align-items-center justify-content-between py-2 border-bottom">' +
				'<div class="min-w-0"><div class="fw-medium text-ov">' + escapeHtml(r.title) + '</div><div class="fs-12 text-muted">' + fmtDate(r.created_at) + (r.model ? " · " + r.model : "") + "</div></div>" +
				'<div class="shrink-0">' +
				'<a href="javascript:;" class="btn btn-light btn-sm sharp me-1 view-run-btn" data-id="' + r.id + '"><i class="fa fa-eye"></i></a>' +
				'<a href="javascript:;" class="btn btn-light btn-sm sharp delete-run-btn" data-id="' + r.id + '"><i class="fa fa-trash text-danger"></i></a>' +
				"</div></div>"
			);
		}).join(""));
	}

	function loadRuns() {
		return supabase.from("cluster_runs").select("id, title, cluster_key, status, created_at, model").eq("client_id", clientId).order("created_at", { ascending: false })
			.then(function (res) {
				runs = res.data || [];
				renderCatalog();
				renderRuns();
			});
	}

	function openViewer(html, title) {
		$("#viewerTitle").text(title);
		document.getElementById("viewerFrame").srcdoc = html;
		$("#clusterViewer").removeClass("d-none").data("html", html).data("title", title);
	}

	$("#viewerCloseBtn").on("click", function () { $("#clusterViewer").addClass("d-none"); });
	$("#viewerDownloadBtn").on("click", function () {
		var html = $("#clusterViewer").data("html");
		var title = $("#clusterViewer").data("title") || "estrategia";
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

	$(document).on("click", ".view-run-btn", function () {
		var id = $(this).data("id");
		var run = runs.filter(function (r) { return String(r.id) === String(id); })[0];
		supabase.from("cluster_runs").select("output_html").eq("id", id).maybeSingle().then(function (res) {
			if (!res.data || !res.data.output_html) { alert("Esta corrida no tiene resultado."); return; }
			openViewer(res.data.output_html, run ? run.title : "Estrategia");
		});
	});

	var deleteTargetId = null;
	$(document).on("click", ".delete-run-btn", function () {
		deleteTargetId = $(this).data("id");
		bootstrap.Modal.getOrCreateInstance(document.getElementById("deleteRunModal")).show();
	});
	$("#confirmDeleteRunBtn").on("click", function () {
		if (!deleteTargetId) return;
		supabase.from("cluster_runs").delete().eq("id", deleteTargetId).then(function () {
			bootstrap.Modal.getOrCreateInstance(document.getElementById("deleteRunModal")).hide();
			deleteTargetId = null;
			loadRuns();
		});
	});

	function runCluster(clusterKey) {
		if (runningKey) return;
		var def = ClusterLib.getClusterDef(clusterKey);
		var total = def.navLabels.length;
		runningKey = clusterKey;
		elapsed = 0;
		renderCatalog({ section: 0, chars: 0 });
		elapsedTimer = setInterval(function () { elapsed++; renderCatalog({ section: window.__clusterProgress ? window.__clusterProgress.section : 0 }); }, 1000);

		AuditClient.getSession().then(function (sessionRes) {
			var accessToken = sessionRes && sessionRes.access_token;
			return fetch(SUPABASE_URL + "/functions/v1/projection-cluster", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + (accessToken || SUPABASE_ANON_KEY),
					apikey: SUPABASE_ANON_KEY,
				},
				body: JSON.stringify({ clientId: clientId, clusterKey: clusterKey }),
			});
		}).then(function (res) {
			if (!res.ok) {
				return res.json().catch(function () { return {}; }).then(function (body) {
					throw new Error(body.error || "Falló el cluster (" + res.status + ")");
				});
			}
			if (!res.body) throw new Error("Sin stream de respuesta");

			var reader = res.body.getReader();
			var decoder = new TextDecoder();
			var buffer = "";
			var raw = "";

			function pump() {
				return reader.read().then(function (result) {
					if (result.done) return;
					buffer += decoder.decode(result.value, { stream: true });
					var lines = buffer.split("\n");
					buffer = lines.pop() || "";
					lines.forEach(function (line) {
						if (line.indexOf("data: ") !== 0) return;
						var payload = line.slice(6).trim();
						if (!payload || payload === "[DONE]") return;
						try {
							var evt = JSON.parse(payload);
							if (evt.type === "content_block_delta" && evt.delta && evt.delta.text) raw += evt.delta.text;
							else if (evt.choices && evt.choices[0] && evt.choices[0].delta && evt.choices[0].delta.content) raw += evt.choices[0].delta.content;
							else if (evt.type === "error" || evt.error) throw new Error((evt.error && evt.error.message) || "AI stream error");
						} catch (e) {
							if (!(e instanceof SyntaxError)) throw e;
						}
					});
					var parsed = ClusterLib.parseFormulaStream(raw);
					window.__clusterProgress = { section: parsed.currentSection };
					renderCatalog(window.__clusterProgress);
					return pump();
				});
			}

			return pump().then(function () {
				var parsed = ClusterLib.parseFormulaStream(raw);
				if (!parsed.hero || parsed.sections.length < total) {
					throw new Error("Generación incompleta (" + parsed.sections.length + "/" + total + " secciones) — intenta de nuevo");
				}
				var html = ClusterLib.buildFormulaHtml(parsed.hero, parsed.sections.slice(0, total), def.navLabels);
				var title = def.title + " — " + ($("#clientTitle").data("name") || "Cliente");

				return supabase.auth.getUser().then(function (userRes) {
					var userId = userRes.data && userRes.data.user && userRes.data.user.id;
					return supabase.from("cluster_runs").insert({
						user_id: userId, client_id: clientId, cluster_key: clusterKey,
						title: title, status: "done", output_html: html, model: "claude-sonnet-4-6",
					});
				}).then(function () {
					openViewer(html, title);
					return loadRuns();
				});
			});
		}).catch(function (err) {
			alert((err && err.message) || "Falló el cluster");
		}).then(function () {
			if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
			runningKey = null;
			renderCatalog();
		});
	}

	$(document).on("click", ".run-cluster-btn", function () { runCluster($(this).data("key")); });
	$("#logoutLink").on("click", function (e) { e.preventDefault(); AuditClient.signOut(); });

	if (!clientId) {
		showOnly($clientNotFound);
	} else {
		AuditClient.getSession().then(function (session) {
			if (!session) { showOnly($authRequired); window.location.replace("page-login.html"); return; }
			showOnly($loading);
			supabase.from("audit_clients").select("id, name, description").eq("id", clientId).maybeSingle()
				.then(function (res) {
					if (res.error) { showOnly($migrationPending); return; }
					if (!res.data) { showOnly($clientNotFound); return; }
					$("#clientTitle").text(res.data.name + " — Clusters de proyección").data("name", res.data.name);
					$("#briefLink").attr("href", "brief.html?client_id=" + clientId);
					return supabase.from("brand_briefs").select("*").eq("client_id", clientId).maybeSingle();
				})
				.then(function (res) {
					if (!res) return;
					var brief = res.data || {};
					var skip = ["id", "user_id", "client_id", "account_id", "account_name", "created_at", "updated_at"];
					var filled = Object.keys(brief).filter(function (k) { return skip.indexOf(k) === -1 && brief[k] != null && brief[k] !== ""; }).length;
					if (filled < 3) $("#briefWarning").removeClass("d-none");
					return loadRuns();
				})
				.then(function () { showOnly($content); })
				.catch(function (err) { console.error(err); });
		});
	}
})(jQuery);
