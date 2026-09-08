(function () {
	"use strict";

	if (typeof AuditClient === "undefined") return;

	AuditClient.redirectIfAuthenticated("clientes.html");

	var form = document.getElementById("register-form");
	var errorBox = document.getElementById("register-error");
	var successBox = document.getElementById("register-success");
	var submitBtn = document.getElementById("register-submit");

	if (!form) return;

	function hideMessages() {
		errorBox.classList.add("d-none");
		successBox.classList.add("d-none");
	}

	function showError(message) {
		errorBox.textContent = message;
		errorBox.classList.remove("d-none");
	}

	form.addEventListener("submit", function (e) {
		e.preventDefault();
		hideMessages();

		var email = document.getElementById("email").value.trim();
		var password = document.getElementById("dz-password").value;

		submitBtn.disabled = true;
		submitBtn.textContent = "Creando cuenta...";

		AuditClient.supabase.auth.signUp({ email: email, password: password })
			.then(function (res) {
				submitBtn.disabled = false;
				submitBtn.textContent = "Crear cuenta";

				if (res.error) {
					showError(AuditClient.authErrorMessage(res.error));
					return;
				}

				// Si el proyecto tiene confirmación de correo activada, signUp
				// no devuelve una sesión activa — hay que avisarle al usuario
				// en vez de redirigir a una página que igual lo va a rebotar.
				if (res.data && res.data.session) {
					window.location.replace("clientes.html");
				} else {
					form.reset();
					successBox.textContent = "Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.";
					successBox.classList.remove("d-none");
				}
			})
			.catch(function (err) {
				submitBtn.disabled = false;
				submitBtn.textContent = "Crear cuenta";
				showError(AuditClient.authErrorMessage(err));
			});
	});
})();
