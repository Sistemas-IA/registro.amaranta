document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-registro");
  const modal = document.getElementById("modal");
  const modalMensaje = document.getElementById("modal-mensaje");
  const modalCerrar = document.getElementById("modal-cerrar");

  const showModal = mensaje => {
    modalMensaje.textContent = mensaje;
    modal.style.display = "block";
  };
  const hideModal = () => (modal.style.display = "none");
  modalCerrar.addEventListener("click", hideModal);

  // Leer lista desde URL (?l=1, etc.)
  const params = new URLSearchParams(window.location.search);
  const listaValor = params.get("l");
  const inputLista = document.getElementById("input-lista");
  if (listaValor && /^[0-9]{1,2}$/.test(listaValor)) {
    inputLista.value = listaValor;
  }

  let datosPendientes = null; // Se guarda hasta que reCAPTCHA devuelva token

  form.addEventListener("submit", event => {
    event.preventDefault();

    const formData = new FormData(form);
    const datos = Object.fromEntries(formData.entries());

    // Validaciones frontend
    const errores = validarFormulario(datos);
    if (errores.length > 0) {
      showModal(errores.join("\n"));
      return;
    }

    // Guardamos los datos y disparamos reCAPTCHA invisible
    datosPendientes = datos;
    grecaptcha.execute();     // El widget está vinculado al botón submit
  });

  // Callback global llamado por reCAPTCHA v2 Invisible
  window.onCaptchaSuccess = async function (token) {
    if (!token || !datosPendientes) {
      showModal("⚠️ Error al verificar reCAPTCHA. Intentalo de nuevo.");
      return;
    }

    datosPendientes.recaptcha = token;

    try {
      const respuesta = await fetch("/api/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datosPendientes)
      });

      const resultado = await respuesta.json();
      if (resultado.exito) {
        showModal("✅ Registro exitoso");
        form.reset();
      } else {
        showModal(resultado.mensaje || "⚠️ Error interno");
      }
    } catch (err) {
      console.error(err);
      showModal("⚠️ Error en la conexión");
    } finally {
      datosPendientes = null;
      grecaptcha.reset(); // Prepara el widget para un nuevo intento
    }
  };
});