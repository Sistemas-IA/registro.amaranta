// public/src/main.js
import {
  esDNIValido, esEmailValido, esTelefonoValido, esTextoValido,
  esDireccionValida, esComentarioValido, esListaPermitida,
  normalizarTelefono, sanitizar
} from "./validaciones.js";

/* ╭─────────────────────────────
   │ 1) Lectura y sanitización    │
   ╰───────────────────────────── */
function obtenerDatos() {
  const f = document.forms["form-registro"];
  return {
    Nombre:      sanitizar(f.Nombre.value),
    Apellido:    sanitizar(f.Apellido.value),
    DNI:         sanitizar(f.DNI.value),
    Email:       sanitizar(f.Email.value).toLowerCase(),
    CodArea:     sanitizar(f.CodArea.value),
    Numero:      sanitizar(f.Numero.value),
    Direccion:   sanitizar(f.Direccion.value),
    Comentarios: sanitizar(f.Comentarios.value),
    Lista:       sanitizar(f.Lista.value),
    Zona:        f.Zona.value,   // honeypots
    Estado:      f.Estado.value
  };
}

function validarCliente(d) {
  const errores = [];
  if (!esTextoValido(d.Nombre))             errores.push("Nombre");
  if (!esTextoValido(d.Apellido))           errores.push("Apellido");
  if (!esDNIValido(d.DNI))                  errores.push("DNI");
  if (!esEmailValido(d.Email))              errores.push("Email");
  if (!esTelefonoValido(d.CodArea,d.Numero))errores.push("Teléfono");
  if (!esDireccionValida(d.Direccion))      errores.push("Dirección");
  if (!esComentarioValido(d.Comentarios))   errores.push("Comentarios");
  if (!esListaPermitida(d.Lista))           errores.push("Lista");
  return errores;
}

/* ╭─────────────────────────────
   │ 2) Interceptar el submit    │
   ╰───────────────────────────── */
const form = document.getElementById("form-registro");
form.addEventListener("submit", e => {
  e.preventDefault();

  const datos   = obtenerDatos();
  const errores = validarCliente(datos);
  if (errores.length) {
    alert("Corrige: " + errores.join(", "));
    return;
  }

  // Ejecuta el reCAPTCHA Invisible → llamará a onCaptchaSuccess
  grecaptcha.execute();
});

/* ╭──────────────────────────────
   │ 3) Callback global del token │
   ╰────────────────────────────── */
window.onCaptchaSuccess = async function (token) {
  const datos = obtenerDatos();
  datos.recaptcha = token;                       // Añade el token

  try {
    console.log("ENVIANDO A /api/registrar", datos);
    const resp = await fetch("/api/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    const json = await resp.json();
    if (json.exito) {
      alert("✅ ¡Registrado con éxito!");
      form.reset();
      grecaptcha.reset();
    } else {
      console.error(json);
      alert(json.mensaje || "Error en el registro");
      grecaptcha.reset();
    }
  } catch (err) {
    console.error(err);
    alert("Error de conexión con el servidor");
    grecaptcha.reset();
  }
};
