(function () {
	"use strict";

	if (typeof AuditClient === "undefined") return;

	// Si ya hay sesión activa, no tiene sentido mostrar el form de login.
	AuditClient.redirectIfAuthenticated("clientes.html");

	var form = document.getElementById("login-form");
	var errorBox = document.getElementById("login-error");
	var submitBtn = document.getElementById("login-submit");

	if (!form) return;

	function showError(message) {
		errorBox.textContent = message;
		errorBox.classList.remove("d-none");
	}

	function hideError() {
		errorBox.classList.add("d-none");
	}

	form.addEventListener("submit", function (e) {
		e.preventDefault();
		hideError();

		var email = document.getElementById("email").value.trim();
		var password = document.getElementById("dz-password").value;

		submitBtn.disabled = true;
		submitBtn.textContent = "Ingresando...";

		AuditClient.supabase.auth.signInWithPassword({ email: email, password: password })
			.then(function (res) {
				if (res.error) {
					showError(AuditClient.authErrorMessage(res.error));
					submitBtn.disabled = false;
					submitBtn.textContent = "Iniciar sesión";
					return;
				}
				window.location.replace("clientes.html");
			})
			.catch(function (err) {
				showError(AuditClient.authErrorMessage(err));
				submitBtn.disabled = false;
				submitBtn.textContent = "Iniciar sesión";
			});
	});
})();
