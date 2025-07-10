document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-registro");
  const modal = document.getElementById("modal");
  const modalMensaje = document.getElementById("modal-mensaje");
  const modalCerrar = document.getElementById("modal-cerrar");

  const showModal = (mensaje) => {
    modalMensaje.textContent = mensaje;
    modal.style.display = "block";
  };

  const hideModal = () => {
    modal.style.display = "none";
  };

  modalCerrar.addEventListener("click", hideModal);

  // Leer lista desde URL
  const params = new URLSearchParams(window.location.search);
  const listaValor = params.get("l");
  const inputLista = document.getElementById("input-lista");
  if (listaValor && /^[0-9]{1,2}$/.test(listaValor)) {
    inputLista.value = listaValor;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const datos = Object.fromEntries(formData.entries());

    const errores = validarFormulario(datos);
    if (errores.length > 0) {
      showModal(errores.join("\n"));
      return;
    }

    // Verificación segura de reCAPTCHA
    if (typeof grecaptcha === "undefined" || !grecaptcha.execute) {
      showModal("⚠️ El sistema de verificación no está listo. Esperá unos segundos y volvé a intentar.");
      return;
    }

    grecaptcha.ready(() => {
      grecaptcha.execute(CONFIG.RECAPTCHA_SITE_KEY, { action: "submit" }).then(async (token) => {
        if (!token) {
          showModal("⚠️ Error al verificar reCAPTCHA. Intentalo de nuevo.");
          return;
        }

        datos.recaptcha = token;

        try {
          const respuesta = await fetch("/api/registrar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
          });

          const resultado = await respuesta.json();

          if (respuesta.ok && resultado.exito) {
            showModal(MENSAJES.exito);
            form.reset();
            inputLista.value = listaValor || "";
          } else {
            showModal(resultado.mensaje || MENSAJES.error);
          }
        } catch (error) {
          console.error("Error en envío:", error);
          showModal(MENSAJES.error);
        }
      });
    });
  });
});
