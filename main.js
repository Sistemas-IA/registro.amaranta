
document.addEventListener("DOMContentLoaded", () => {
  const formulario = document.getElementById("formulario");
  const modalExito = document.getElementById("modalExito");
  const modalError = document.getElementById("modalError");
  const contenido = document.getElementById("contenidoPrincipal");

  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();

    const datos = {
      nombre: formulario.nombre.value.trim(),
      apellido: formulario.apellido.value.trim(),
      dni: formulario.dni.value.trim(),
      telefono: formulario.telefono.value.trim(),
      email: formulario.email.value.trim(),
      direccion: formulario.direccion.value.trim(),
      comentarios: formulario.comentarios.value.trim(),
      zona: "",
      estado: "",
      lista: formulario.lista.value || localStorage.getItem("lista") || ""
    };

    try {
      const respuesta = await fetch("/api/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
      });

      const mensaje = await respuesta.text();

      if (mensaje === "Registrado con éxito") {
        mostrarModalExito();
        formulario.reset();
      } else {
        mostrarError("Error al registrar: " + mensaje);
      }
    } catch (error) {
      mostrarError("No se pudo conectar. Intentalo nuevamente.");
    }
  });

  window.mostrarError = function(mensaje) {
    document.getElementById("mensajeError").textContent = mensaje;
    modalError.classList.add("mostrar");
  }

  window.cerrarModalError = function() {
    modalError.classList.remove("mostrar");
  }

  window.mostrarModalExito = function() {
    modalExito.classList.add("mostrar");
    contenido.classList.add("blur");
  }

  window.cerrarModalExito = function() {
    modalExito.classList.remove("mostrar");
    contenido.classList.remove("blur");
  }
});
