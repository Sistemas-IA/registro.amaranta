const MENSAJES = {
  ERROR_DNI: "El DNI debe tener exactamente 8 dígitos numéricos.",
  ERROR_NOMBRE: "El nombre es obligatorio.",
  ERROR_APELLIDO: "El apellido es obligatorio.",
  ERROR_DIRECCION: "La dirección de entrega es obligatoria.",
  ERROR_TELEFONO: "El teléfono debe tener un código de área de 2 a 4 dígitos y un número de 7 a 9 dígitos.",
  ERROR_EMAIL: "El formato del correo electrónico no es válido.",
  YA_REGISTRADO: "Ya existe un registro con estos datos.",
  BOT_DETECTADO: "Bot detectado. Operación cancelada.",
  ERROR_GENERAL: "Ha ocurrido un error. Por favor, intente nuevamente.",
  REGISTRO_OK: "¡Registro exitoso! Muchas gracias.",
};

const form = document.getElementById("formulario");
const modal = document.getElementById("modalError");
const modalMsg = document.getElementById("modalMensaje");

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  limpiarErrores();

  const nombre = document.getElementById("nombre").value.trim();
  const apellido = document.getElementById("apellido").value.trim();
  const dni = document.getElementById("dni").value.trim();
  const codigoArea = document.getElementById("codigoArea").value.trim();
  const numeroTel = document.getElementById("numeroTel").value.trim();
  const email = document.getElementById("email").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const comentarios = document.getElementById("comentarios").value.trim();
  const zona = document.getElementById("zona").value.trim();
  const estado = document.getElementById("estado").value.trim();
  const lista = new URLSearchParams(window.location.search).get("l") || "desconocida";

  let hayErrores = false;

  if (!nombre) setError("nombre", MENSAJES.ERROR_NOMBRE), hayErrores = true;
  if (!apellido) setError("apellido", MENSAJES.ERROR_APELLIDO), hayErrores = true;
  if (!/^[0-9]{8}$/.test(dni)) setError("dni", MENSAJES.ERROR_DNI), hayErrores = true;
  if (!/^[0-9]{2,4}$/.test(codigoArea) || !/^[0-9]{7,9}$/.test(numeroTel)) setError("telefono", MENSAJES.ERROR_TELEFONO), hayErrores = true;
  if (!/^\S+@\S+\.\S{2,}$/.test(email)) setError("email", MENSAJES.ERROR_EMAIL), hayErrores = true;
  if (!direccion) setError("direccion", MENSAJES.ERROR_DIRECCION), hayErrores = true;

  if (hayErrores) return;

  const telefono = codigoArea + numeroTel;

  const datos = {
    nombre, apellido, dni, telefono, email, direccion,
    comentarios, zona, estado, lista
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
      form.reset();
      showModal(MENSAJES.REGISTRO_OK);
    } else {
      showModal(json.message || MENSAJES.ERROR_GENERAL);
    }
  } catch (error) {
    showModal(MENSAJES.ERROR_GENERAL);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Registrarse";
  }
});

function setError(id, mensaje) {
  const campo = document.getElementById("error-" + id);
  if (campo) campo.textContent = mensaje;
}

function limpiarErrores() {
  const errores = document.querySelectorAll(".error-msg");
  errores.forEach((el) => (el.textContent = ""));
}

function showModal(mensaje) {
  modalMsg.textContent = mensaje;
  modal.showModal();
}