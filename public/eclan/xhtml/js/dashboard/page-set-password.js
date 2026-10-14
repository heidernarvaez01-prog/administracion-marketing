/**
 * Procesa los links de invitación/recuperación de Supabase Auth y deja que
 * la persona elija su contraseña, sin pasar por la app React (/app/auth) —
 * portado de src/pages/AuthPage.tsx (verifyOtp/exchangeCodeForSession +
 * updateUser). A diferencia de login.js, NUNCA llama a
 * AuditClient.redirectIfAuthenticated: el link ya trae (o va a establecer)
 * una sesión nueva, y mandar a esa persona directo a clientes.html antes de
 * que elija contraseña la dejaría con una cuenta sin contraseña utilizable.
 * Primero se procesa el link, luego se muestra el formulario, y solo
 * después de updateUser se redirige.
 */
(function ($) {
	"use strict";

	if (typeof AuditClient === "undefined") return;
	var supabase = AuditClient.supabase;

	var $verifying = $("#spVerifying");
	var $error = $("#spError");
	var $errorMsg = $("#spErrorMsg");
	var $saved = $("#spSaved");
	var $form = $("#spForm");
	var $formError = $("#spFormError");
	var $password = $("#spPassword");
	var $confirm = $("#spConfirm");
	var $submit = $("#spSubmit");

	function showOnly($el) {
		[$verifying, $error, $saved, $form].forEach(function ($x) { $x.addClass("d-none"); });
		$el.removeClass("d-none");
	}

	function showLinkError(message) {
		$errorMsg.text(message);
		showOnly($error);
	}

	// Nunca deja el token en la URL una vez procesado (ni en query ni en hash).
	function stripUrl() {
		window.history.replaceState(null, "", window.location.pathname);
	}

	// El link puede llegar en 3 formatos, según la versión de Supabase:
	// "?code=…" (PKCE), "?token_hash=…&type=…" (verificación OTP), o el hash
	// legacy "#access_token=…&type=…" (supabase-js lo hidrata solo al cargar
	// el cliente — detectSessionInUrl=true por default en supabase-client.js).
	function parseAuthUrl() {
		var url = new URL(window.location.href);
		var hash = new URLSearchParams(url.hash.replace(/^#/, ""));
		function pick(k) { return url.searchParams.get(k) || hash.get(k); }
		return {
			code: url.searchParams.get("code"),
			token_hash: pick("token_hash"),
			type: pick("type"),
			error: pick("error") || pick("error_code"),
			error_description: pick("error_description"),
		};
	}

	var params = parseAuthUrl();

	if (params.error_description || params.error) {
		stripUrl();
		showLinkError(decodeURIComponent(params.error_description || params.error));
	} else if (params.token_hash && params.type) {
		supabase.auth.verifyOtp({ token_hash: params.token_hash, type: params.type }).then(function (res) {
			stripUrl();
			if (res.error) { showLinkError(AuditClient.authErrorMessage(res.error)); return; }
			showOnly($form);
		});
	} else if (params.code) {
		supabase.auth.exchangeCodeForSession(params.code).then(function (res) {
			stripUrl();
			if (res.error) { showLinkError(AuditClient.authErrorMessage(res.error)); return; }
			showOnly($form);
		});
	} else {
		// Hash legacy (o navegación directa sin token): si supabase-js ya
		// hidrató una sesión desde el hash, getSession() la ve; si no, el
		// link es inválido/expirado o ya se usó.
		stripUrl();
		supabase.auth.getSession().then(function (res) {
			if (res.data && res.data.session) { showOnly($form); return; }
			showLinkError("Link inválido o expirado.");
		});
	}

	$form.on("submit", function (e) {
		e.preventDefault();
		$formError.addClass("d-none");
		var pw = $password.val();
		var confirm = $confirm.val();

		if (pw.length < 8) { $formError.text("La contraseña debe tener al menos 8 caracteres.").removeClass("d-none"); return; }
		if (pw !== confirm) { $formError.text("Las contraseñas no coinciden.").removeClass("d-none"); return; }

		$submit.prop("disabled", true).text("Guardando…");
		supabase.auth.updateUser({ password: pw }).then(function (res) {
			if (res.error) {
				$formError.text(AuditClient.authErrorMessage(res.error)).removeClass("d-none");
				$submit.prop("disabled", false).text("Guardar y entrar");
				return;
			}
			showOnly($saved);
			setTimeout(function () { window.location.replace("clientes.html"); }, 900);
		});
	});
})(jQuery);
