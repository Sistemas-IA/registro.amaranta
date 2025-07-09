// main.js

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-registro");
  const modal = document.getElementById("modal");
  const modalMensaje = document.getElementById("modal-mensaje");
  const modalCerrar = document.getElementById("modal-cerrar");

  // Cargar valor de Lista desde URL
  const params = new URLSearchParams(window.location.search);
  const lista = params.get("l");
  document.getElementById("input-lista").value = lista || "";

  modalCerrar.addEventListener("click", () => {
    modal.style.display = "none";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const datos = Object.fromEntries(new FormData(form));

    // Validaciones
    try {
      if (!esTextoValido(datos.Nombre)) throw MENSAJES.ERROR_NOMBRE;
      if (!esTextoValido(datos.Apellido)) throw MENSAJES.ERROR_APELLIDO;
      if (!esDNIValido(datos.DNI)) throw MENSAJES.ERROR_DNI;
      if (!esTelefonoValido(datos.CodArea, datos.Numero)) throw MENSAJES.ERROR_TEL;
      if (!esEmailValido(datos.Email)) throw MENSAJES.ERROR_EMAIL;
      if (!esDireccionValida(datos.Direccion)) throw MENSAJES.ERROR_DIRECCION;
      if (!esComentarioValido(datos.Comentarios)) throw MENSAJES.ERROR_COMENTARIO;
      if (!esHoneypotVacio(datos.Zona) || !esHoneypotVacio(datos.Estado)) throw MENSAJES.ERROR_HONEYPOT;
      if (!esListaPermitida(datos.Lista)) throw MENSAJES.ERROR_LISTA;
    } catch (msg) {
      mostrarModal(msg);
      return;
    }

    // Preparar datos normalizados
    const payload = {
      Nombre: sanitizar(datos.Nombre),
      Apellido: sanitizar(datos.Apellido),
      DNI: datos.DNI.trim(),
      Telefono: normalizarTelefono(datos.CodArea, datos.Numero),
      Email: datos.Email.trim().toLowerCase(),
      Direccion: sanitizar(datos.Direccion),
      Comentarios: sanitizar(datos.Comentarios || ""),
      Zona: "",
      Estado: "",
      Lista: datos.Lista.trim(),
    };

    // Ejecutar reCAPTCHA
    try {
      const token = await grecaptcha.execute(CONFIG.RECAPTCHA_SITE_KEY, { action: "submit" });
      payload.recaptchaToken = token;
    } catch (_) {
      mostrarModal(MENSAJES.ERROR_CAPTCHA);
      return;
    }

    // Enviar al backend
    try {
      const res = await fetch("/api/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const respuesta = await res.json();

      if (respuesta.ok) {
        mostrarModal(MENSAJES.EXITO);
        form.reset();
      } else {
        mostrarModal(respuesta.error || MENSAJES.ERROR_GENERAL);
      }
    } catch (_) {
      mostrarModal(MENSAJES.ERROR_GENERAL);
    }
  });

  function mostrarModal(msg) {
    modalMensaje.textContent = msg;
    modal.style.display = "block";
  }
});
