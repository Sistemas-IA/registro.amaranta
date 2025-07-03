const MENSAJES = {
  ERROR_DNI: "El DNI debe tener exactamente 8 dígitos numéricos.",
  ERROR_TELEFONO: "El teléfono debe tener un código de área de 2 a 4 dígitos y un número de 7 a 9 dígitos.",
  ERROR_EMAIL: "El formato del correo electrónico no es válido.",
  YA_REGISTRADO: "Ya existe un registro con estos datos.",
  BOT_DETECTADO: "Bot detectado. Operación cancelada.",
  ERROR_GENERAL: "Ha ocurrido un error. Por favor, intente nuevamente.",
  REGISTRO_OK: "¡Registro exitoso! Muchas gracias.",
};


document.getElementById("formulario").addEventListener("submit", async function (e) {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value.trim();
  const apellido = document.getElementById("apellido").value.trim();
  const dni = document.getElementById("dni").value.trim();
  const codigoArea = document.getElementById("codigoArea").value.trim();
  const numeroTel = document.getElementById("numeroTel").value.trim();
  const email = document.getElementById("email").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const comentarios = document.getElementById("comentarios").value.trim();
  const camposExtra = document.getElementById("camposExtra").value.trim();
  const lista = new URLSearchParams(window.location.search).get("l") || "desconocida";

  if (!/^\d{8}$/.test(dni)) return alert(MENSAJES.ERROR_DNI);
  if (!/^\d{2,4}$/.test(codigoArea) || !/^\d{7,9}$/.test(numeroTel)) return alert(MENSAJES.ERROR_TELEFONO);
  if (!/^\S+@\S+\.\S{2,}$/.test(email)) return alert(MENSAJES.ERROR_EMAIL);

  const telefono = codigoArea + numeroTel;

  const datos = {
    nombre, apellido, dni, telefono, email, direccion, comentarios, camposExtra, lista
  };

  const btn = document.getElementById("btnEnviar");
  btn.disabled = true;
  btn.innerHTML = "Enviando...";

  try {
    const res = await fetch("api/registrar.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const json = await res.json();
    if (json.success) {
      alert(MENSAJES.REGISTRO_OK);
      document.getElementById("formulario").reset();
    } else {
      alert(json.message || MENSAJES.ERROR_GENERAL);
    }
  } catch (error) {
    alert(MENSAJES.ERROR_GENERAL);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Registrarse";
  }
});