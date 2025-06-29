document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const mensaje = document.getElementById("mensaje");

  const generarToken = () => {
    return 'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  let token = generarToken();
  let ip = "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mensaje.innerText = "";
    let errores = [];

    const datos = {
      nombre: form.nombre.value.trim(),
      apellido: form.apellido.value.trim(),
      dni: form.dni.value.trim(),
      telefono: form.telefono.value.trim(),
      email: form.email.value.trim(),
      direccion: form.direccion.value.trim(),
      comentarios: form.comentarios.value.trim(),
      lista: form.lista?.value || "",
      ip,
      token
    };

    const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/;
    const simbolosPeligrosos = /^[=+\-@]/;
    const caracteresNoPermitidos = /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,@\-']/;

    if (!soloLetras.test(datos.nombre)) errores.push("El nombre solo puede contener letras y espacios.");
    if (!soloLetras.test(datos.apellido)) errores.push("El apellido solo puede contener letras y espacios.");

    for (const [clave, valor] of Object.entries(datos)) {
      if (simbolosPeligrosos.test(valor)) errores.push("El campo '" + clave + "' no puede comenzar con =, +, - o @.");
      if (caracteresNoPermitidos.test(valor)) errores.push("El campo '" + clave + "' contiene caracteres no permitidos.");
    }

    if (errores.length > 0) {
      alert("Por favor corregí los siguientes errores:\n\n" + errores.join("\n"));
      return;
    }

    try {
      const res = await fetch("/api/registrar.js", {
        method: "POST",
        body: JSON.stringify(datos),
        headers: { "Content-Type": "application/json" }
      });
      const resultado = await res.json();
      mensaje.innerText = resultado.mensaje;
      if (resultado.estado === "ok") form.reset();
    } catch (err) {
      mensaje.innerText = "Error al enviar el formulario.";
    }
  });
});