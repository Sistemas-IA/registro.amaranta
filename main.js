document.getElementById("registrationForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const datos = {
    nombre: form.nombre.value.trim(),
    apellido: form.apellido.value.trim(),
    dni: form.dni.value.trim(),
    telefono: "549" + form.codArea.value.trim() + form.telefono.value.trim(),
    email: form.email.value.trim(),
    direccion: form.direccion.value.trim(),
    comentarios: form.comentarios.value.trim(),
    extra: form.extra.value.trim(),
    lista: form.lista.value.trim()
  };

  // Validaciones frontend
  const regexNombre = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s']{2,40}$/;
  const regexDNI = /^\d{8}$/;
  const regexTel = /^\d{10,15}$/;
  const regexEmail = /^\S+@\S+\.\S+$/;

  if (!regexNombre.test(datos.nombre) || !regexNombre.test(datos.apellido)) return alert("Nombre o apellido inválido.");
  if (!regexDNI.test(datos.dni)) return alert("DNI inválido.");
  if (!regexTel.test(datos.telefono)) return alert("Teléfono inválido.");
  if (!regexEmail.test(datos.email) || datos.email.length > 60) return alert("Email inválido.");
  if (datos.extra !== "") return; // Honeypot activado

  try {
    const res = await fetch("https://script.google.com/macros/s/AKfycbwGLyOORR5qUf-vPiJKXzb9fSMNxf86cv3dLkffEUN7mjniUygswbp7jrrWgaAku32Y7Q/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    const resultado = await res.json();
    alert(resultado.mensaje || "Registro completo.");
    form.reset();
  } catch (err) {
    console.error("Error al enviar:", err);
    alert("Error al enviar. Intentá más tarde.");
  }
});
