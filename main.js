document.getElementById("formulario").addEventListener("submit", async (e) => {
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
    lista: form.lista?.value?.trim() || "no definida"
  };

  const regexNombre = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s']{2,40}$/;
  const regexDNI = /^\d{8}$/;
  const regexTel = /^\d{10,15}$/;
  const regexEmail = /^\S+@\S+\.\S+$/;

  if (!regexNombre.test(datos.nombre) || !regexNombre.test(datos.apellido)) return alert("Nombre o apellido inválido.");
  if (!regexDNI.test(datos.dni)) return alert("DNI inválido.");
  if (!regexTel.test(datos.telefono)) return alert("Teléfono inválido.");
  if (!regexEmail.test(datos.email) || datos.email.length > 60) return alert("Email inválido.");
  if (datos.extra !== "") return; // Honeypot activado (bot)

  try {
    const params = new URLSearchParams(datos).toString();
    const url = "https://script.google.com/macros/s/AKfycbyQKE_7ZjPYEmVKEYbFn35s1Eij88-ELkjxS05EHY1VGvjkak9RGb4UmPu8REAC7iK9HQ/exec?" + params;

    const res = await fetch(url);
    const resultado = await res.json();

    alert(resultado.mensaje || "Registro completo.");
    form.reset();
  } catch (err) {
    console.error("Error al enviar:", err);
    alert("Error al enviar. Intentá más tarde.");
  }
});
