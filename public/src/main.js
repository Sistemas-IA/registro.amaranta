// main.js (corregido)

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

  // Leer lista desde URL (?l=1, etc.)
  const params = new URLSearchParams(window.location.search);
  const listaValor = params.get("l");
  const inputLista = document.getElementById("input-lista");
  if (listaValor && /^[0-9]{1,2}$/.test(listaValor)) {
    inputLista.value = listaValor;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // 🛑 Prevenir envío clásico (evita URL sucia)

    const formData = new FormData(form);
    const datos = Object.fromEntries(formData.entries());

    try {
      // Validaciones frontend
      const errores = validarFormulario(datos);
      if (errores.length > 0) {
        showModal(errores.join("\n"));
        return;
      }

      // Obtener token de reCAPTCHA invisible
      const token = await grecaptcha.execute(CONFIG.RECAPTCHA_SITE_KEY, {
        action: "submit"
      });

      datos.recaptcha = token;

      // Enviar al backend
      const respuesta = await fetch("/api/registrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(datos)
      });

      const resultado = await respuesta.json();

      if (respuesta.ok && resultado.exito) {
        showModal(MENSAJES.exito);
        form.reset(); // ✅ Solo si fue exitoso
        document.getElementById("input-lista").value = listaValor || "";
      } else {
        showModal(resultado.mensaje || MENSAJES.error);
      }
    } catch (error) {
      console.error("Error en envío:", error);
      showModal(MENSAJES.error);
    }
  });
});
